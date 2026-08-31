-- stamp_business_card() already requires cards.stamp, but the integrity
-- trigger it reaches while updating card_instances still allowed only the
-- business owner. That made a permitted administrator's transaction roll back
-- after the stamp row had been prepared.

create or replace function public.guard_card_instance_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

  -- A wallet card cannot be moved to another program. Reassigning its owner
  -- remains owner-only and is not granted by the stamping permission.
  if new.template_id is distinct from old.template_id then
    raise exception 'not authorized to change template_id';
  end if;
  if new.customer_id is distinct from old.customer_id
     and auth.uid() is distinct from v_owner_id then
    raise exception 'not authorized to change customer_id';
  end if;

  if new.stamps_count is distinct from old.stamps_count
     or new.completed_at is distinct from old.completed_at then

    -- The SECURITY DEFINER stamping RPC reaches this branch with the original
    -- caller still available through auth.uid(). Owners pass implicitly;
    -- administrators must hold cards.stamp on this exact business.
    if public.has_business_permission(v_business_id, auth.uid(), 'cards.stamp') then
      return new;
    end if;

    -- Customers may only perform the controlled completed-card renewal.
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

-- Historical migrations used two names for the same trigger. Leave exactly
-- one active trigger so every update is checked once by the repaired function.
drop trigger if exists guard_card_instance_update on public.card_instances;
drop trigger if exists guard_card_instance_update_trg on public.card_instances;

create trigger guard_card_instance_update_trg
before update on public.card_instances
for each row execute function public.guard_card_instance_update();

revoke all on function public.guard_card_instance_update() from public, anon, authenticated;
grant execute on function public.guard_card_instance_update() to service_role;
