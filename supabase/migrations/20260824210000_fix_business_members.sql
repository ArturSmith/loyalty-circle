-- Fixes for adding an administrator.
--
-- Two separate defects made this fail:
--
--   1. New businesses had no owner membership row. The foundation migration
--      backfilled existing businesses once, but nothing creates the row going
--      forward, so any business created after that migration showed an empty
--      team list — the owner was missing from their own team.
--
--   2. Emails were stored as typed. Uniqueness is enforced case-insensitively
--      by a functional index on lower(email), but the application looks rows up
--      with an exact match, so "Sam@x.com" and "sam@x.com" were the same row to
--      Postgres and two different rows to the app. Re-inviting someone whose
--      stored address differed in case would hit the unique index and fail.

/* ------------------------------------------------- normalise stored emails */

update public.business_members
set email = lower(email)
where email <> lower(email);

-- Keep it that way regardless of who writes the row.
create or replace function public.business_members_normalize_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists business_members_normalize_email_trg on public.business_members;
create trigger business_members_normalize_email_trg
  before insert or update of email on public.business_members
  for each row execute function public.business_members_normalize_email();

/* ------------------------------------------------ owner membership on insert */

create or replace function public.business_add_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.owner_id;

  insert into public.business_members
    (business_id, user_id, email, role, status, accepted_at)
  values
    (new.id, new.owner_id, lower(coalesce(v_email, '')), 'owner', 'active', now())
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists business_add_owner_member_trg on public.businesses;
create trigger business_add_owner_member_trg
  after insert on public.businesses
  for each row execute function public.business_add_owner_member();

-- Catch up the businesses created between the foundation migration and now.
insert into public.business_members (business_id, user_id, email, role, status, accepted_at)
select b.id, b.owner_id, lower(coalesce(u.email, '')), 'owner', 'active', now()
from public.businesses b
join auth.users u on u.id = b.owner_id
where not exists (
  select 1 from public.business_members m
  where m.business_id = b.id and m.role = 'owner'
)
on conflict do nothing;
