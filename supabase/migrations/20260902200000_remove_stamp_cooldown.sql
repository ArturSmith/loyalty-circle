-- Allow consecutive stamps without a time-based cooldown. Serialize changes
-- before reading progress, so simultaneous scans cannot lose stamps or issue
-- the same reward twice. Permissions, subscription checks and full-card limits
-- stay enforced. Existing rows and stamp/reward history are not modified.
begin;

-- The old INSERT trigger independently enforced another 30-second cooldown.
-- Serialization now happens at the start of the stamping RPC instead.
drop trigger if exists enforce_card_stamp_cooldown_trg on public.stamps;
drop function if exists public.enforce_card_stamp_cooldown();

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
  v_new_count integer;
  v_reward jsonb;
  v_reward_label text;
  v_vouchers jsonb := '[]'::jsonb;
  v_voucher_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select * into v_instance from public.card_instances where id = _card_instance_id for update;
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

-- Older clients still use add_stamp. Keep it owner-only, but delegate the
-- write to the same locked implementation so no legacy cooldown remains.
-- Remove the obsolete one-argument overload: the default _env below supports
-- those calls already, and keeping both makes PostgreSQL resolution ambiguous.
drop function if exists public.add_stamp(uuid);
create or replace function public.add_stamp(_card_instance_id uuid, _env text default 'live'::text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_business_id uuid;
  v_owner_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select b.id, b.owner_id into v_business_id, v_owner_id
  from public.card_instances ci
  join public.card_templates t on t.id = ci.template_id
  join public.businesses b on b.id = t.business_id
  where ci.id = _card_instance_id;
  if not found then raise exception 'card not found'; end if;
  if v_owner_id <> auth.uid() then raise exception 'not authorized'; end if;
  return public.stamp_business_card(_card_instance_id, v_business_id, _env);
end;
$$;

revoke all on function public.stamp_business_card(uuid, uuid, text) from public, anon;
grant execute on function public.stamp_business_card(uuid, uuid, text) to authenticated;
revoke all on function public.add_stamp(uuid, text) from public, anon;
grant execute on function public.add_stamp(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
