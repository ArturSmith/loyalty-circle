-- ClubCarder Enterprise: business platform foundation.
--
-- Adds the four things the current schema has no concept of:
--   1. business_members  — multiple administrators per business
--   2. business_locations — a business is no longer a single address
--   3. business_socials   — "My Networks"
--   4. marketplace + onboarding state on businesses
--
-- IMPORTANT: this migration is additive. It does NOT rewrite the existing
-- owner_id-based RLS policies on card_templates/card_instances/etc. Those still
-- grant access to the owner only. Widening them to members is a deliberate
-- second step, because getting it wrong silently exposes one business's
-- customers to another's staff.

/* ------------------------------------------------------------ businesses */

alter table public.businesses
  add column if not exists onboarding_step smallint not null default 1,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists marketplace_status text not null default 'unpublished'
    check (marketplace_status in ('unpublished', 'pending', 'published', 'rejected')),
  add column if not exists marketplace_rejection_reason text,
  add column if not exists marketplace_submitted_at timestamptz;

comment on column public.businesses.onboarding_step is
  'Furthest wizard step reached (1-8). Steps 3,4,5,6 are skippable.';

/* -------------------------------------------------------- business_members */

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  -- Null until the invitee accepts: an invitation exists before the account does.
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  -- Explicit grants layered on top of the role, so a plan can restrict an admin
  -- without inventing a new role each time.
  permissions text[] not null default '{}',
  status text not null default 'invited'
    check (status in ('invited', 'active', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  invite_token uuid not null default gen_random_uuid(),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- One membership per email per business, so re-inviting updates rather than duplicates.
create unique index if not exists business_members_unique_email_idx
  on public.business_members (business_id, lower(email));
create index if not exists business_members_user_idx
  on public.business_members (user_id) where user_id is not null;
create index if not exists business_members_token_idx
  on public.business_members (invite_token);

/* ------------------------------------------------------ business_locations */

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  latitude double precision,
  longitude double precision,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_locations_business_idx
  on public.business_locations (business_id);

/* -------------------------------------------------------- business_socials */

create table if not exists public.business_socials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  platform text not null check (platform in (
    'instagram','facebook','tiktok','x','youtube','linkedin','snapchat','website','other'
  )),
  url text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists business_socials_unique_idx
  on public.business_socials (business_id, platform);

/* ------------------------------------------------------------ entitlements */

-- The plan a subscription grants. Nullable so existing rows keep working; the
-- application treats null as the legacy single-tier plan.
alter table public.subscriptions
  add column if not exists plan_tier text
    check (plan_tier in ('starter', 'growth', 'scale'));

/* ------------------------------------------------------------------ helper */

-- Used by RLS below. security definer so it can read business_members without
-- the caller needing a policy on it (which would recurse).
create or replace function public.is_business_member(_business_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = _business_id and b.owner_id = _user_id
  ) or exists (
    select 1 from public.business_members m
    where m.business_id = _business_id
      and m.user_id = _user_id
      and m.status = 'active'
  );
$$;

/* ----------------------------------------------------------------- grants */

grant select, insert, update, delete on public.business_members to authenticated;
grant select, insert, update, delete on public.business_locations to authenticated;
grant select, insert, update, delete on public.business_socials to authenticated;
grant select on public.business_locations to anon;
grant select on public.business_socials to anon;
grant all on public.business_members to service_role;
grant all on public.business_locations to service_role;
grant all on public.business_socials to service_role;

/* -------------------------------------------------------------------- RLS */

alter table public.business_members enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_socials enable row level security;

-- Members: only the OWNER may manage staff. An admin must not be able to
-- promote themselves or invite further admins.
drop policy if exists "Owners manage members" on public.business_members;
create policy "Owners manage members" on public.business_members
  for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_members.business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b
                      where b.id = business_members.business_id and b.owner_id = auth.uid()));

-- A member may read their own membership row (to discover what they can do).
drop policy if exists "Members read own membership" on public.business_members;
create policy "Members read own membership" on public.business_members
  for select to authenticated
  using (user_id = auth.uid());

-- Locations and socials are public-facing (marketplace, business page).
drop policy if exists "Locations publicly readable" on public.business_locations;
create policy "Locations publicly readable" on public.business_locations
  for select using (true);

drop policy if exists "Members manage locations" on public.business_locations;
create policy "Members manage locations" on public.business_locations
  for all to authenticated
  using (public.is_business_member(business_id, auth.uid()))
  with check (public.is_business_member(business_id, auth.uid()));

drop policy if exists "Socials publicly readable" on public.business_socials;
create policy "Socials publicly readable" on public.business_socials
  for select using (true);

drop policy if exists "Members manage socials" on public.business_socials;
create policy "Members manage socials" on public.business_socials
  for all to authenticated
  using (public.is_business_member(business_id, auth.uid()))
  with check (public.is_business_member(business_id, auth.uid()));

/* ------------------------------------------------------ backfill ownership */

-- Every existing business gets an owner membership row so the members UI has
-- something coherent to show from day one.
insert into public.business_members (business_id, user_id, email, role, status, accepted_at)
select b.id, b.owner_id, coalesce(u.email, ''), 'owner', 'active', now()
from public.businesses b
join auth.users u on u.id = b.owner_id
on conflict do nothing;

-- Existing businesses predate the wizard; treat them as fully onboarded.
update public.businesses
set onboarding_step = 8,
    onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null;
