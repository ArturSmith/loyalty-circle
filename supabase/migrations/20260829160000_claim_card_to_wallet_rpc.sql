-- Customers cannot INSERT card instances directly. Keep that table privilege
-- closed and expose only this validated, atomic claim operation.

create or replace function public.claim_card_to_wallet(
  _template_id uuid,
  _accepted_terms_version integer
)
returns table(instance_id uuid, already_owned boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_template record;
  v_instance_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select
    t.id,
    t.terms_and_conditions,
    t.terms_version,
    t.active,
    t.accepted_by_platform as card_accepted,
    b.accepted_by_platform as business_accepted
  into v_template
  from public.card_templates t
  join public.businesses b on b.id = t.business_id
  where t.id = _template_id;

  if not found or not v_template.active then
    raise exception 'This card is not available anymore';
  end if;

  if not v_template.card_accepted or not v_template.business_accepted then
    raise exception 'This card is awaiting platform review';
  end if;

  if _accepted_terms_version is null
     or _accepted_terms_version <> v_template.terms_version then
    raise exception 'The card terms changed. Please review and accept the latest version.';
  end if;

  select ci.id
  into v_instance_id
  from public.card_instances ci
  where ci.template_id = _template_id
    and ci.customer_id = v_user_id;

  if found then
    return query select v_instance_id, true;
    return;
  end if;

  begin
    insert into public.card_instances (
      template_id,
      customer_id,
      terms_accepted_at,
      terms_accepted_by,
      terms_accepted_version,
      terms_accepted_text
    ) values (
      _template_id,
      v_user_id,
      now(),
      v_user_id,
      v_template.terms_version,
      v_template.terms_and_conditions
    )
    returning id into v_instance_id;
  exception
    when unique_violation then
      -- Two simultaneous taps still produce one card and a successful result.
      select ci.id
      into v_instance_id
      from public.card_instances ci
      where ci.template_id = _template_id
        and ci.customer_id = v_user_id;

      return query select v_instance_id, true;
      return;
  end;

  return query select v_instance_id, false;
end;
$$;

revoke all on function public.claim_card_to_wallet(uuid, integer) from public, anon;
grant execute on function public.claim_card_to_wallet(uuid, integer) to authenticated, service_role;
