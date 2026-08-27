-- Enforce the same granular admin permissions used by the dashboard UI.
-- This migration only replaces policies and adds one narrowly-scoped RPC; it
-- does not delete, truncate, or rewrite existing business data.

drop policy if exists "Members manage locations" on public.business_locations;
drop policy if exists "Permitted staff manage locations" on public.business_locations;
create policy "Permitted staff manage locations" on public.business_locations
  for all to authenticated
  using (public.can_on_business(business_id, 'locations.manage'))
  with check (public.can_on_business(business_id, 'locations.manage'));

drop policy if exists "Members manage socials" on public.business_socials;
drop policy if exists "Permitted staff manage socials" on public.business_socials;
create policy "Permitted staff manage socials" on public.business_socials
  for all to authenticated
  using (public.can_on_business(business_id, 'marketplace.manage'))
  with check (public.can_on_business(business_id, 'marketplace.manage'));

-- The earlier template policy uses FOR ALL with cards.manage, which also
-- unintentionally blocks read-only analytics/customer admins from seeing the
-- card whose data they are allowed to inspect. PostgreSQL combines SELECT
-- policies permissively, so this adds read access without widening mutations.
drop policy if exists "Permitted staff read templates" on public.card_templates;
create policy "Permitted staff read templates" on public.card_templates
  for select to authenticated
  using (
    public.can_on_business(business_id, 'cards.manage')
    or public.can_on_business(business_id, 'cards.stamp')
    or public.can_on_business(business_id, 'customers.view')
    or public.can_on_business(business_id, 'analytics.view')
  );

-- Business rows are owner-updatable by design. Give marketplace admins a
-- constrained operation that can change only listing visibility, without
-- granting them permission to edit ownership, billing, or business details.
create or replace function public.set_business_marketplace_status(
  _business_id uuid,
  _status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _status not in ('unpublished', 'published') then
    raise exception 'Invalid marketplace status';
  end if;

  if not public.has_business_permission(_business_id, auth.uid(), 'marketplace.manage') then
    raise exception 'Not authorized to manage this marketplace listing';
  end if;

  update public.businesses
  set marketplace_status = _status,
      marketplace_submitted_at = case when _status = 'published' then now() else null end,
      updated_at = now()
  where id = _business_id;

  if not found then
    raise exception 'Business not found';
  end if;
end;
$$;

revoke all on function public.set_business_marketplace_status(uuid, text) from public, anon;
grant execute on function public.set_business_marketplace_status(uuid, text) to authenticated, service_role;
