-- Add the first moderation state to businesses without changing current
-- publication or access behaviour. Existing businesses are grandfathered in;
-- businesses created after this migration wait for platform acceptance.

alter table public.businesses
  add column if not exists accepted_by_platform boolean;

-- The column is nullable while existing rows are backfilled so no current
-- business is unexpectedly hidden or blocked by a later moderation check.
update public.businesses
set accepted_by_platform = true
where accepted_by_platform is null;

alter table public.businesses
  alter column accepted_by_platform set default false,
  alter column accepted_by_platform set not null;

comment on column public.businesses.accepted_by_platform is
  'Whether the platform has accepted this business for publication. New businesses require moderation.';

-- Acceptance is a platform decision. Owners create and edit their businesses
-- through authenticated clients, but those clients must not be able to approve
-- their own rows. A service-role moderation flow can set this value later.
create or replace function public.protect_business_platform_acceptance()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.accepted_by_platform := false;
    elsif new.accepted_by_platform is distinct from old.accepted_by_platform then
      raise exception 'Only the platform can change business acceptance';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_business_platform_acceptance_trg
  on public.businesses;

create trigger protect_business_platform_acceptance_trg
before insert or update of accepted_by_platform on public.businesses
for each row execute function public.protect_business_platform_acceptance();

