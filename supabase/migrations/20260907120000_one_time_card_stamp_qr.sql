-- One-time stamping QR codes, printed/shown by the business for a single card.
--
-- Until now a stamp could only be added by staff scanning the customer. Small
-- counters often have the opposite setup: the customer holds the phone and the
-- till shows a code. This adds that direction without weakening anything - the
-- code is single-use, short-lived, bound to one card template, and only ever
-- minted by someone who already holds `cards.stamp` on that business.
--
-- The stamping rules themselves are not duplicated: the body of
-- stamp_business_card moves into apply_card_stamp so both entry points share
-- one implementation, and only the authorisation differs between them.
begin;

create table if not exists public.card_stamp_qr_tokens (
  token uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.card_templates(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid references public.profiles(id) on delete set null,
  card_instance_id uuid references public.card_instances(id) on delete set null
);

create index if not exists card_stamp_qr_tokens_template_idx
  on public.card_stamp_qr_tokens (template_id, created_at desc);

alter table public.card_stamp_qr_tokens enable row level security;

-- No direct table access: a customer must not be able to read a token they did
-- not scan, and a business must not be able to forge `redeemed_at`.
revoke all on public.card_stamp_qr_tokens from public, anon, authenticated;
grant all on public.card_stamp_qr_tokens to service_role;

comment on table public.card_stamp_qr_tokens is
  'Single-use QR tokens a business shows so a customer can self-stamp one card.';

-- Shared stamping core -------------------------------------------------------
-- Deliberately does NOT check who is calling: both callers below authorise
-- first, in ways that have nothing in common. It does keep every rule that
-- protects the customer and the business (locking, subscription, full card).
create or replace function public.apply_card_stamp(
  _card_instance_id uuid,
  _issued_by uuid,
  _env text default 'live'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_template public.card_templates%rowtype;
  v_business public.businesses%rowtype;
  v_instance public.card_instances%rowtype;
  v_new_count integer;
  v_reward jsonb;
  v_reward_label text;
  v_vouchers jsonb := '[]'::jsonb;
  v_voucher_id uuid;
begin
  select * into v_instance from public.card_instances where id = _card_instance_id for update;
  if not found then raise exception 'card not found'; end if;
  select * into v_template from public.card_templates where id = v_instance.template_id;
  select * into v_business from public.businesses where id = v_template.business_id;

  if not public.business_has_access_v2(v_business.id, coalesce(_env, 'live')) then
    raise exception 'subscription required: this business is not covered by an active Clubcarder subscription, so new stamps are paused.';
  end if;
  if v_instance.stamps_count >= v_template.total_steps then raise exception 'card is full'; end if;

  v_new_count := v_instance.stamps_count + 1;
  insert into public.stamps (card_instance_id, issued_by, business_id, step_number)
  values (_card_instance_id, _issued_by, v_business.id, v_new_count);

  loop
    exit when v_new_count >= v_template.total_steps;
    select r into v_reward
      from jsonb_array_elements(coalesce(v_template.rewards, '[]'::jsonb)) r
      where (r->>'step')::int = v_new_count + 1
      limit 1;
    exit when v_reward is null;
    v_new_count := v_new_count + 1;
    v_reward_label := coalesce(nullif(v_reward->>'label', ''), 'Reward');
    insert into public.vouchers (card_instance_id, template_id, business_id, customer_id, step_number, label)
    values (_card_instance_id, v_template.id, v_business.id, v_instance.customer_id, v_new_count, v_reward_label)
    returning id into v_voucher_id;
    v_vouchers := v_vouchers || jsonb_build_object('id', v_voucher_id, 'step', v_new_count, 'label', v_reward_label);
    v_reward := null;
  end loop;

  update public.card_instances
    set stamps_count = v_new_count,
        completed_at = case when v_new_count >= v_template.total_steps then now() else completed_at end
    where id = _card_instance_id;

  return jsonb_build_object(
    'stamps_count', v_new_count,
    'total_steps', v_template.total_steps,
    'reward', case when jsonb_array_length(v_vouchers) > 0 then v_vouchers -> (jsonb_array_length(v_vouchers) - 1) else null end,
    'vouchers', v_vouchers,
    'completed', v_new_count >= v_template.total_steps
  );
end;
$$;

-- Only reachable through the two RPCs below, never from a browser.
revoke all on function public.apply_card_stamp(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_card_stamp(uuid, uuid, text) to service_role;

-- Staff scanning the customer (unchanged behaviour, shared body) -------------
create or replace function public.stamp_business_card(
  _card_instance_id uuid,
  _business_id uuid,
  _env text default 'live'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_business_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select t.business_id into v_business_id
  from public.card_instances ci
  join public.card_templates t on t.id = ci.template_id
  where ci.id = _card_instance_id;
  if not found then raise exception 'card not found'; end if;

  if v_business_id <> _business_id then
    raise exception 'not authorized';
  end if;
  if not public.has_business_permission(v_business_id, auth.uid(), 'cards.stamp') then
    raise exception 'not authorized';
  end if;

  return public.apply_card_stamp(_card_instance_id, auth.uid(), _env);
end;
$$;

revoke all on function public.stamp_business_card(uuid, uuid, text) from public, anon;
grant execute on function public.stamp_business_card(uuid, uuid, text) to authenticated;

-- Business mints a code ------------------------------------------------------
-- Any previously issued, still-unredeemed code for the same card is expired on
-- the spot. That is what makes "one QR = one stamp" true even if the screen was
-- photographed earlier: only the code currently on display can be redeemed.
create or replace function public.issue_card_stamp_qr_token(
  _template_id uuid,
  _env text default 'live'::text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_business_id uuid;
  v_token uuid;
  v_expires_at timestamptz;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select business_id into v_business_id from public.card_templates where id = _template_id;
  if not found then raise exception 'card not found'; end if;

  if not public.has_business_permission(v_business_id, auth.uid(), 'cards.stamp') then
    raise exception 'permission required: cards.stamp';
  end if;
  if not public.business_has_access_v2(v_business_id, coalesce(_env, 'live')) then
    raise exception 'subscription required: this business is not covered by an active Clubcarder subscription, so new stamps are paused.';
  end if;

  update public.card_stamp_qr_tokens
    set expires_at = now()
    where template_id = _template_id
      and redeemed_at is null
      and expires_at > now();

  -- Opportunistic cleanup keeps the table bounded without a scheduled job.
  delete from public.card_stamp_qr_tokens
    where template_id = _template_id
      and created_at < now() - interval '30 days';

  insert into public.card_stamp_qr_tokens (template_id, business_id, created_by, expires_at)
  values (_template_id, v_business_id, auth.uid(), now() + interval '5 minutes')
  returning token, expires_at into v_token, v_expires_at;

  return jsonb_build_object('token', v_token, 'expires_at', v_expires_at);
end;
$$;

revoke all on function public.issue_card_stamp_qr_token(uuid, text) from public, anon;
grant execute on function public.issue_card_stamp_qr_token(uuid, text) to authenticated;

-- Business screen polls this so it can show the code as spent and mint the
-- next one. Returns nothing identifying beyond the display name of whoever
-- redeemed the code the caller themselves just issued.
create or replace function public.peek_card_stamp_qr_token(_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_row public.card_stamp_qr_tokens%rowtype;
  v_name text;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select * into v_row from public.card_stamp_qr_tokens where token = _token;
  if not found then return jsonb_build_object('status', 'invalid'); end if;

  if not public.has_business_permission(v_row.business_id, auth.uid(), 'cards.stamp') then
    raise exception 'permission required: cards.stamp';
  end if;

  if v_row.redeemed_at is not null then
    select p.display_name into v_name from public.profiles p where p.id = v_row.redeemed_by;
    return jsonb_build_object(
      'status', 'redeemed',
      'redeemed_at', v_row.redeemed_at,
      'customer_name', v_name
    );
  end if;

  if v_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  return jsonb_build_object('status', 'pending', 'expires_at', v_row.expires_at);
end;
$$;

revoke all on function public.peek_card_stamp_qr_token(uuid) from public, anon;
grant execute on function public.peek_card_stamp_qr_token(uuid) to authenticated;

-- Customer redeems a code ----------------------------------------------------
-- Failure modes are returned as a status rather than raised, because every one
-- of them needs its own sentence on the customer's screen. Genuine faults
-- (missing subscription, full card) still raise, matching the staff scanner.
create or replace function public.redeem_card_stamp_qr_token(
  _token uuid,
  _env text default 'live'::text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_row public.card_stamp_qr_tokens%rowtype;
  v_template public.card_templates%rowtype;
  v_business public.businesses%rowtype;
  v_instance public.card_instances%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  -- The lock is what stops two phones scanning the same screen at once from
  -- both being served: the loser sees the row already marked redeemed.
  select * into v_row from public.card_stamp_qr_tokens where token = _token for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_row.redeemed_at is not null then return jsonb_build_object('status', 'already_used'); end if;
  if v_row.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;

  select * into v_template from public.card_templates where id = v_row.template_id;
  select * into v_business from public.businesses where id = v_row.business_id;

  -- Prefer a card with room left, so a customer holding an old completed copy
  -- is not told "card is full" while an empty one sits beside it.
  select ci.* into v_instance
  from public.card_instances ci
  where ci.template_id = v_row.template_id
    and ci.customer_id = auth.uid()
  order by
    (ci.completed_at is null and ci.stamps_count < v_template.total_steps) desc,
    ci.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'status', 'no_card',
      'template_id', v_row.template_id,
      'business_id', v_row.business_id,
      'card_title', v_template.title,
      'business_name', v_business.name
    );
  end if;

  if v_instance.completed_at is not null or v_instance.stamps_count >= v_template.total_steps then
    return jsonb_build_object(
      'status', 'card_full',
      'card_title', v_template.title,
      'business_name', v_business.name
    );
  end if;

  -- Burn the token first. If stamping then raises, the whole transaction rolls
  -- back and the code stays usable - the customer must not lose a stamp here.
  update public.card_stamp_qr_tokens
    set redeemed_at = now(),
        redeemed_by = auth.uid(),
        card_instance_id = v_instance.id
    where token = _token;

  -- Attributed to the staff member who displayed the code, not the customer,
  -- so analytics keep reading "who stamped this" the same way.
  v_result := public.apply_card_stamp(v_instance.id, v_row.created_by, _env);

  return v_result
    || jsonb_build_object(
      'status', 'stamped',
      'instance_id', v_instance.id,
      'card_title', v_template.title,
      'business_name', v_business.name
    );
end;
$$;

revoke all on function public.redeem_card_stamp_qr_token(uuid, text) from public, anon;
grant execute on function public.redeem_card_stamp_qr_token(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
