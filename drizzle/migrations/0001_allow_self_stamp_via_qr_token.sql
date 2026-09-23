-- Self-stamping via a one-time business QR is authorised by the token itself,
-- not by the customer's permissions. apply_card_stamp is only reachable from
-- RPCs that have already authorised the caller, so it flags the update as
-- trusted with a transaction-local setting the guard trigger recognises.
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

  perform set_config('app.stamp_ok', '1', true);
  update public.card_instances
    set stamps_count = v_new_count,
        completed_at = case when v_new_count >= v_template.total_steps then now() else completed_at end
    where id = _card_instance_id;
  perform set_config('app.stamp_ok', '0', true);

  return jsonb_build_object(
    'stamps_count', v_new_count,
    'total_steps', v_template.total_steps,
    'reward', case when jsonb_array_length(v_vouchers) > 0 then v_vouchers -> (jsonb_array_length(v_vouchers) - 1) else null end,
    'vouchers', v_vouchers,
    'completed', v_new_count >= v_template.total_steps
  );
end;
$$;

revoke all on function public.apply_card_stamp(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_card_stamp(uuid, uuid, text) to service_role;

create or replace function public.guard_card_instance_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_business_id uuid;
  v_owner_id uuid;
  v_total_steps integer;
begin
  select b.id, b.owner_id, t.total_steps
    into v_business_id, v_owner_id, v_total_steps
  from public.card_templates t
  join public.businesses b on b.id = t.business_id
  where t.id = old.template_id;

  if not found then
    raise exception 'card template not found';
  end if;

  if new.template_id is distinct from old.template_id then
    raise exception 'not authorized to change template_id';
  end if;
  if new.customer_id is distinct from old.customer_id
     and auth.uid() is distinct from v_owner_id then
    raise exception 'not authorized to change customer_id';
  end if;

  if new.stamps_count is distinct from old.stamps_count
     or new.completed_at is distinct from old.completed_at then

    -- Stamping RPCs authorise before calling apply_card_stamp, which marks the
    -- update as trusted. Unreachable from a browser: apply_card_stamp has no
    -- execute grant for anon/authenticated.
    if current_setting('app.stamp_ok', true) = '1' then
      return new;
    end if;

    if public.has_business_permission(v_business_id, auth.uid(), 'cards.stamp') then
      return new;
    end if;

    if current_setting('app.renew_ok', true) = '1'
       and auth.uid() = new.customer_id
       and old.stamps_count >= v_total_steps
       and new.stamps_count = 0
       and new.completed_at is null then
      return new;
    end if;

    raise exception 'permission required: cards.stamp';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';