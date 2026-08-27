-- Business cards and aggregate dashboard counts are basic workspace context.
-- Every active team member may see them; analytics.view continues to protect
-- event history, trends, wallet analytics, and per-customer activity.

drop policy if exists "Permitted staff read templates" on public.card_templates;
drop policy if exists "Team members read templates" on public.card_templates;
create policy "Team members read templates" on public.card_templates
  for select to authenticated
  using (public.is_business_member(business_id, auth.uid()));

create or replace function public.get_business_dashboard_stats(_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stamps bigint;
  v_customers bigint;
  v_active_cards bigint;
begin
  if auth.uid() is null
     or not public.is_business_member(_business_id, auth.uid()) then
    raise exception 'Not authorized to view this business';
  end if;

  select count(*) into v_stamps
  from public.stamps
  where business_id = _business_id;

  select count(distinct ci.customer_id) into v_customers
  from public.card_instances ci
  join public.card_templates t on t.id = ci.template_id
  where t.business_id = _business_id;

  select count(*) into v_active_cards
  from public.card_templates
  where business_id = _business_id and active = true;

  return jsonb_build_object(
    'stamps', v_stamps,
    'customers', v_customers,
    'active', v_active_cards
  );
end;
$$;

revoke all on function public.get_business_dashboard_stats(uuid) from public, anon;
grant execute on function public.get_business_dashboard_stats(uuid) to authenticated, service_role;
