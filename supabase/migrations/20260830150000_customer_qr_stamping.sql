-- One customer-level QR can resolve every loyalty card that customer holds for
-- the business currently operating the scanner. The opaque token avoids
-- exposing auth.users.id in screenshots while carrying no authority by itself.

alter table public.profiles
  add column if not exists customer_qr_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_customer_qr_token_key
  on public.profiles (customer_qr_token);

comment on column public.profiles.customer_qr_token is
  'Opaque identifier shown in the customer wallet QR. It grants no access without an authenticated staff permission check.';

-- The scanner already pauses after reading a QR, but two staff devices can
-- still submit the same card concurrently. Serialize inserts per card before
-- enforcing the cooldown so both requests cannot pass the timestamp check.
create or replace function public.enforce_card_stamp_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.card_instance_id::text, 0));

  if exists (
    select 1
    from public.stamps s
    where s.card_instance_id = new.card_instance_id
      and s.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'please wait a moment before stamping again';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_card_stamp_cooldown_trg on public.stamps;
create trigger enforce_card_stamp_cooldown_trg
before insert on public.stamps
for each row execute function public.enforce_card_stamp_cooldown();

revoke all on function public.enforce_card_stamp_cooldown() from public, anon, authenticated;

-- Column grants on profiles intentionally expose only display fields to other
-- users. Let a customer retrieve only their own token through this narrow RPC.
create or replace function public.get_my_customer_qr_token()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  select p.customer_qr_token
    into v_token
  from public.profiles p
  where p.id = auth.uid();

  if v_token is null then
    raise exception 'profile not found';
  end if;

  return v_token;
end;
$$;

-- Resolve the scanned identity only inside the selected business. Raw profile
-- rows and cards from other businesses never leave the database function.
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
    raise exception 'not authorized';
  end if;

  select p.*
    into v_customer
  from public.profiles p
  where p.customer_qr_token = _customer_qr_token;

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

revoke all on function public.get_my_customer_qr_token() from public, anon;
grant execute on function public.get_my_customer_qr_token() to authenticated, service_role;

revoke all on function public.resolve_customer_cards_for_business(uuid, uuid) from public, anon;
grant execute on function public.resolve_customer_cards_for_business(uuid, uuid) to authenticated, service_role;
