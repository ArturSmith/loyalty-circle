-- Repair the two compatibility edges in customer-level QR stamping:
--   1. Administrators invited before automatic account linking may still be
--      represented only by their verified email address.
--   2. Older/cached wallet screens can contain the legacy auth user UUID QR,
--      while the new resolver originally accepted only customer_qr_token.
--
-- The cards.stamp permission remains mandatory in every case. Email matching
-- only links an existing Supabase Auth account to the exact address invited by
-- the business owner; it does not grant a permission absent from the row.

update public.business_members m
set user_id = u.id,
    status = 'active',
    accepted_at = coalesce(m.accepted_at, now())
from auth.users u
where m.role = 'admin'
  and m.status <> 'revoked'
  and m.user_id is null
  and u.email is not null
  and lower(btrim(m.email)) = lower(btrim(u.email));

create or replace function public.has_business_permission(
  _business_id uuid,
  _user_id uuid,
  _permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = _business_id
      and b.owner_id = _user_id
  ) or exists (
    select 1
    from public.business_members m
    where m.business_id = _business_id
      and m.status = 'active'
      and (
        m.user_id = _user_id
        or (
          m.user_id is null
          and lower(btrim(m.email)) = lower(btrim(coalesce(
            (select u.email from auth.users u where u.id = _user_id),
            ''
          )))
        )
      )
      and (
        m.role = 'owner'
        or _permission = any(m.permissions)
      )
  );
$$;

revoke all on function public.has_business_permission(uuid, uuid, text) from public, anon;
grant execute on function public.has_business_permission(uuid, uuid, text) to authenticated, service_role;

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

  -- Prefer the opaque token, but keep already-rendered legacy user QR codes
  -- working. The scanned identifier carries no authority: results remain
  -- business-scoped and require an authenticated staff permission check above.
  select p.*
    into v_customer
  from public.profiles p
  where p.customer_qr_token = _customer_qr_token
     or p.id = _customer_qr_token
  order by (p.customer_qr_token = _customer_qr_token) desc
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
