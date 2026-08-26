-- A profile can contain sensitive personal fields (for example date_of_birth).
-- RLS works at row level, so cross-party SELECT policies on the base table
-- would expose *every* column on a permitted row. Keep the base table private
-- and expose only identity display fields through this deliberately narrow view.

drop policy if exists "Business owners visible to their customers" on public.profiles;
drop policy if exists "Customers visible to their business owners" on public.profiles;
drop policy if exists "Customers visible to their business staff" on public.profiles;

revoke select on public.profiles from authenticated;
revoke select on public.profiles from anon;
grant select (id, display_name, avatar_url, created_at) on public.profiles to authenticated;

create or replace view public.profiles_public
with (security_invoker = false) as
select p.id, p.display_name, p.avatar_url
from public.profiles p
where p.id = auth.uid()
  or exists (
    select 1
    from public.businesses b
    join public.card_templates t on t.business_id = b.id
    join public.card_instances ci on ci.template_id = t.id
    where b.owner_id = p.id
      and ci.customer_id = auth.uid()
  )
  or exists (
    select 1
    from public.card_instances ci
    join public.card_templates t on t.id = ci.template_id
    where ci.customer_id = p.id
      and public.has_business_permission(t.business_id, auth.uid(), 'customers.view')
  );

revoke all on public.profiles_public from anon;
grant select on public.profiles_public to authenticated;
grant all on public.profiles_public to service_role;
