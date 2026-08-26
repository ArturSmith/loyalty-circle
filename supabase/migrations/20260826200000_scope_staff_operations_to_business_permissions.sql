-- Complete the multi-business permission model for the staff-facing card
-- workflow.  The earlier multi-admin migration updated mutation policies, but
-- left a few read policies and the SECURITY DEFINER scan functions checking
-- only businesses.owner_id.  That made an active administrator look like they
-- had no access despite being assigned the relevant business permissions.

drop policy if exists "Owner reads business instances" on public.card_instances;
drop policy if exists "Members read business instances" on public.card_instances;
create policy "Members read business instances" on public.card_instances
  for select to authenticated
  using (public.can_on_template(template_id, 'customers.view'));

drop policy if exists "Owner reads own stamps" on public.stamps;
drop policy if exists "Members read business stamps" on public.stamps;
create policy "Members read business stamps" on public.stamps
  for select to authenticated
  using (public.can_on_business(business_id, 'analytics.view'));

-- The selected dashboard business is part of the scan contract. This keeps an
-- owner of two businesses from accidentally stamping a Business A card while
-- operating Business B's scanner. New function names deliberately leave the
-- legacy RPCs untouched, so applying this migration is safe and repeatable.
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
  v_template public.card_templates%rowtype;
  v_business public.businesses%rowtype;
  v_instance public.card_instances%rowtype;
  v_last_stamp timestamptz;
  v_new_count integer;
  v_reward jsonb;
  v_reward_label text;
  v_vouchers jsonb := '[]'::jsonb;
  v_voucher_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select * into v_instance from public.card_instances where id = _card_instance_id;
  if not found then raise exception 'card not found'; end if;
  select * into v_template from public.card_templates where id = v_instance.template_id;
  select * into v_business from public.businesses where id = v_template.business_id;

  if v_business.id <> _business_id then
    raise exception 'not authorized';
  end if;

  if not public.has_business_permission(v_business.id, auth.uid(), 'cards.stamp') then
    raise exception 'not authorized';
  end if;
  if not public.business_has_access_v2(v_business.id, coalesce(_env, 'live')) then
    raise exception 'subscription required: this business is not covered by an active Clubcarder subscription, so new stamps are paused.';
  end if;
  if v_instance.stamps_count >= v_template.total_steps then raise exception 'card is full'; end if;

  select max(created_at) into v_last_stamp from public.stamps where card_instance_id = _card_instance_id;
  if v_last_stamp is not null and v_last_stamp > now() - interval '30 seconds' then
    raise exception 'please wait a moment before stamping again';
  end if;

  v_new_count := v_instance.stamps_count + 1;
  insert into public.stamps (card_instance_id, issued_by, business_id, step_number)
  values (_card_instance_id, auth.uid(), v_business.id, v_new_count);

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

create or replace function public.redeem_business_voucher(_voucher_id uuid, _business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_voucher public.vouchers%rowtype;
  v_business public.businesses%rowtype;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into v_voucher from public.vouchers where id = _voucher_id;
  if not found then raise exception 'voucher not found'; end if;
  select * into v_business from public.businesses where id = v_voucher.business_id;
  if v_business.id <> _business_id then
    raise exception 'not authorized';
  end if;
  if not public.has_business_permission(v_business.id, auth.uid(), 'cards.stamp') then
    raise exception 'not authorized';
  end if;
  if v_voucher.status = 'used' then raise exception 'voucher already used'; end if;

  update public.vouchers
    set status = 'used', redeemed_at = now(), redeemed_by = auth.uid()
    where id = _voucher_id;

  return jsonb_build_object('id', v_voucher.id, 'label', v_voucher.label, 'business_name', v_business.name);
end;
$$;

revoke all on function public.stamp_business_card(uuid, uuid, text) from public, anon;
grant execute on function public.stamp_business_card(uuid, uuid, text) to authenticated;
revoke all on function public.redeem_business_voucher(uuid, uuid) from public, anon;
grant execute on function public.redeem_business_voucher(uuid, uuid) to authenticated;
