-- Views are security definer by default on older Postgres versions, which can
-- make a view execute with its creator's privileges.  Use normal RLS for row
-- relationships and PostgreSQL column grants for field sensitivity instead.
-- Authenticated users can read only the listed display fields; attempting to
-- select date_of_birth (or any other sensitive column) is denied by PostgreSQL
-- before RLS can return it.

drop view if exists public.profiles_public;

drop policy if exists "Business owners visible to their customers" on public.profiles;
drop policy if exists "Customers visible to their business owners" on public.profiles;
drop policy if exists "Customers visible to their business staff" on public.profiles;

create policy "Business owners visible to their customers"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    join public.card_templates t on t.business_id = b.id
    join public.card_instances ci on ci.template_id = t.id
    where b.owner_id = profiles.id
      and ci.customer_id = auth.uid()
  )
);

create policy "Customers visible to their business staff"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.card_instances ci
    join public.card_templates t on t.id = ci.template_id
    where ci.customer_id = profiles.id
      and public.has_business_permission(t.business_id, auth.uid(), 'customers.view')
  )
);

revoke select on public.profiles from authenticated;
revoke select on public.profiles from anon;
grant select (id, display_name, avatar_url, created_at) on public.profiles to authenticated;
