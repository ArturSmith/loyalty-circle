-- Short-lived customer QR tokens are issued only while the customer has the
-- My QR modal open. Tokens overlap long enough for a scanner that has already
-- captured the previous frame to finish its request safely.

create table if not exists public.customer_qr_sessions (
  token uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists customer_qr_sessions_customer_expires_idx
  on public.customer_qr_sessions (customer_id, expires_at desc);

alter table public.customer_qr_sessions enable row level security;

revoke all on public.customer_qr_sessions from public, anon, authenticated;
grant all on public.customer_qr_sessions to service_role;

comment on table public.customer_qr_sessions is
  'Short-lived customer identity tokens rendered only by an open My QR modal.';

create or replace function public.issue_my_rotating_customer_qr_token()
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'profile not found';
  end if;

  -- Opportunistic cleanup keeps the table bounded without a scheduled job.
  delete from public.customer_qr_sessions s
  where s.customer_id = auth.uid()
    and s.expires_at <= now();

  insert into public.customer_qr_sessions (customer_id, expires_at)
  values (auth.uid(), now() + interval '75 seconds')
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.issue_my_rotating_customer_qr_token() from public, anon;
grant execute on function public.issue_my_rotating_customer_qr_token() to authenticated, service_role;

-- Keep permanent-token and legacy user-id support for cached clients, while
-- preferring a currently valid rotating session from the new modal.
create or replace function public.resolve_customer_cards_for_business(
  _business_id uuid,
  _customer_qr_token uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.profiles%rowtype;
  v_cards jsonb;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  if not public.has_business_permission(_business_id, auth.uid(), 'cards.stamp') then
    raise exception 'permission required: cards.stamp';
  end if;

  select p.*
    into v_customer
  from public.profiles p
  left join public.customer_qr_sessions s
    on s.customer_id = p.id
   and s.token = _customer_qr_token
   and s.expires_at > now()
  where s.token is not null
     or p.customer_qr_token = _customer_qr_token
     or p.id = _customer_qr_token
  order by
    (s.token is not null) desc,
    (p.customer_qr_token = _customer_qr_token) desc
  limit 1;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'instance_id', ci.id,
        'template_id', t.id,
        'title', t.title,
        'subtitle', t.subtitle,
        'stamps_count', ci.stamps_count,
        'total_steps', t.total_steps,
        'completed_at', ci.completed_at,
        'active', t.active,
        'accent_color', t.accent_color,
        'rewards', t.rewards,
        'created_at', ci.created_at
      )
      order by
        (ci.completed_at is null and ci.stamps_count < t.total_steps) desc,
        ci.created_at desc
    ),
    '[]'::jsonb
  )
    into v_cards
  from public.card_instances ci
  join public.card_templates t on t.id = ci.template_id
  where ci.customer_id = v_customer.id
    and t.business_id = _business_id;

  if jsonb_array_length(v_cards) = 0 then
    return jsonb_build_object('status', 'no_cards');
  end if;

  return jsonb_build_object(
    'status', 'found',
    'customer', jsonb_build_object(
      'id', v_customer.id,
      'display_name', v_customer.display_name,
      'avatar_url', v_customer.avatar_url
    ),
    'cards', v_cards
  );
end;
$$;

revoke all on function public.resolve_customer_cards_for_business(uuid, uuid) from public, anon;
grant execute on function public.resolve_customer_cards_for_business(uuid, uuid) to authenticated, service_role;

