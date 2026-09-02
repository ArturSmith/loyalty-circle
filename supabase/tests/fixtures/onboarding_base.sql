-- Minimal schema for the isolated onboarding regression test ONLY.
-- Run only in a new, disposable PostgreSQL database, never in a Supabase project.
create schema auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end; $$;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claim.role', true);
$$;
create table public.profiles (
  id uuid primary key references auth.users(id), trial_started_at timestamptz, trial_consumed_at timestamptz
);
create table public.user_roles (user_id uuid, role text);
create table public.businesses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
  name text not null, category text, logo_url text, brand_color text, description text,
  welcome_message text, phone text, website text, address_line1 text, address_line2 text,
  city text, postal_code text, region text, country text, latitude double precision, longitude double precision,
  onboarding_step smallint default 1, onboarding_completed_at timestamptz,
  marketplace_status text default 'unpublished', marketplace_submitted_at timestamptz,
  comped boolean not null default false, trial_started_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.card_templates (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  title text not null, subtitle text, description text, corner_title text,
  total_steps integer not null default 10 check (total_steps between 0 and 32),
  shape text not null default 'rounded' check (shape in ('rounded','square','ticket')),
  bg_color text not null default '#faf7ee', accent_color text not null default '#1a1a2e',
  text_color text not null default '#1a1a2e', stamp_icon text not null default 'star',
  stamp_shape text not null default 'circle', step_size text not null default 'medium', logo_url text,
  rewards jsonb not null default '[]', grid_cols smallint, active boolean not null default true,
  terms_and_conditions text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_locations (
  id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id), name text,
  address_line1 text, address_line2 text, city text, region text, postal_code text, country text,
  phone text, latitude double precision, longitude double precision, is_primary boolean,
  created_at timestamptz default now()
);
create table public.business_socials (
  business_id uuid references public.businesses(id), platform text, url text,
  primary key (business_id, platform)
);
create table public.card_instances (id uuid primary key, template_id uuid, customer_id uuid);
create table public.stamps (
  id uuid primary key, card_instance_id uuid, business_id uuid, step_number integer, created_at timestamptz default now()
);
create function public.is_business_member(_business_id uuid, _user_id uuid) returns boolean language sql as $$
  select exists (select 1 from public.businesses where id = _business_id and owner_id = _user_id);
$$;
create function public.has_business_permission(_business_id uuid, _user_id uuid, _permission text) returns boolean language sql as $$
  select public.is_business_member(_business_id, _user_id);
$$;
create function public.can_on_business(_business_id uuid, _permission text) returns boolean language sql as $$
  select public.has_business_permission(_business_id, auth.uid(), _permission);
$$;
create function public.active_subscription_count(_user_id uuid, _env text) returns integer language sql as $$ select 0; $$;
create function public.business_trial_active(_business_id uuid) returns boolean language sql as $$
  select exists (select 1 from public.businesses where id = _business_id and trial_started_at + interval '14 days' > now());
$$;
create publication supabase_realtime;

\ir ../../migrations/20260828100000_business_platform_acceptance.sql
\ir ../../migrations/20260828110000_content_moderation_workflow.sql
\ir ../../migrations/20260828130000_moderation_comparison_snapshot.sql
\ir ../../migrations/20260828150000_notifications.sql
\ir ../../migrations/20260828210000_dedupe_moderation_notifications.sql

-- Preserve the real insertion-trigger ordering when exercising the replacement.
create function public.start_trial_on_first_business() returns trigger language plpgsql as $$ begin return new; end; $$;
create function public.guard_business_slot() returns trigger language plpgsql as $$ begin return new; end; $$;
create trigger trg_guard_business_slot before insert on public.businesses for each row execute function public.guard_business_slot();

\ir ../../migrations/20260902150000_business_onboarding_review.sql
