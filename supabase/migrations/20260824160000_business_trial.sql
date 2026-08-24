-- Trial moves from the account to the business.
--
-- Previously the 14-day clock lived on profiles.trial_started_at, so an owner
-- who had ever created a business could never see a trial again — even after
-- deleting it. That is why creating a fresh business dropped straight to the
-- paywall.
--
-- The clock now lives on the business, but a lifetime marker stays on the
-- account: businesses.trial_started_at is only populated while
-- profiles.trial_consumed_at is null. So the first business gets a genuine
-- 14 days and delete-and-recreate cannot mint another one.
--
-- profiles.trial_started_at is deliberately left in place. It still records
-- when the account first tried the product, and dropping a column that older
-- deployed code may still select would break the running app mid-deploy.

/* ------------------------------------------------------------------ schema */

alter table public.businesses
  add column if not exists trial_started_at timestamptz;

comment on column public.businesses.trial_started_at is
  'When this business'' 14-day trial began. Null means it never had one.';

alter table public.profiles
  add column if not exists trial_consumed_at timestamptz;

comment on column public.profiles.trial_consumed_at is
  'Set the first time this account is granted a trial. Never cleared — it is what stops delete-and-recreate from earning a second trial.';

/* ---------------------------------------------------------------- backfill */

-- The oldest business of each owner inherits that owner's original trial date,
-- so nobody currently mid-trial loses time when this ships.
with ranked as (
  select b.id,
         b.owner_id,
         row_number() over (partition by b.owner_id order by b.created_at, b.id) as rnk
  from public.businesses b
)
update public.businesses b
set trial_started_at = coalesce(p.trial_started_at, b.created_at)
from ranked r
join public.profiles p on p.id = r.owner_id
where b.id = r.id
  and r.rnk = 1
  and b.trial_started_at is null;

-- Any account that already had a trial date has, by definition, consumed it.
update public.profiles
set trial_consumed_at = trial_started_at
where trial_started_at is not null
  and trial_consumed_at is null;

/* ----------------------------------------------------------------- trigger */

-- BEFORE INSERT so the value is written as part of the row itself rather than
-- a follow-up update that could fail silently.
--
-- Fires after trg_guard_business_slot (triggers run in name order, g < s), so a
-- business that is about to be rejected never consumes the trial.
create or replace function public.start_trial_on_first_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumed timestamptz;
begin
  -- The profile row is normally created by the auth trigger, but if it is
  -- missing we must not silently skip the trial the way the old code did.
  insert into public.profiles (id)
  values (new.owner_id)
  on conflict (id) do nothing;

  select trial_consumed_at into v_consumed
  from public.profiles
  where id = new.owner_id
  for update;

  if v_consumed is null then
    new.trial_started_at := coalesce(new.trial_started_at, now());
    update public.profiles
      set trial_consumed_at = now(),
          trial_started_at = coalesce(trial_started_at, now())
      where id = new.owner_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_start_trial_on_first_business on public.businesses;
create trigger trg_start_trial_on_first_business
before insert on public.businesses
for each row execute function public.start_trial_on_first_business();

/* ----------------------------------------------------------------- helpers */

-- Whether this specific business is inside its trial window.
create or replace function public.business_trial_active(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = _business_id
      and b.trial_started_at is not null
      and b.trial_started_at + interval '14 days' > now()
  );
$$;

revoke all on function public.business_trial_active(uuid) from public, anon;
grant execute on function public.business_trial_active(uuid) to authenticated, service_role;

-- The old account-level check defaulted a missing date to now(), which handed
-- out an unlimited trial to anyone without a profile row. Report the truth
-- instead: no recorded trial means no trial.
create or replace function public.account_trial_active(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.owner_id = _user_id
      and b.trial_started_at is not null
      and b.trial_started_at + interval '14 days' > now()
  );
$$;

/* ------------------------------------------------------------ access check */

-- Access is unchanged except that the trial is now asked of the business
-- rather than of the account.
create or replace function public.business_has_access_v2(_business_id uuid, _env text default 'live')
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_rank int;
  v_subs int;
begin
  select owner_id into v_owner from public.businesses where id = _business_id;
  if v_owner is null then return false; end if;

  v_rank := public.business_slot_rank(_business_id);
  v_subs := public.active_subscription_count(v_owner, _env);
  if v_subs >= v_rank then return true; end if;

  return public.business_trial_active(_business_id);
end;
$$;

/* ------------------------------------------------------------------ grants */

grant select (id, display_name, avatar_url, created_at, updated_at,
              trial_started_at, trial_consumed_at)
  on public.profiles to authenticated;
