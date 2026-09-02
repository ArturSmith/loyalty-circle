-- Ensure approval, rather than draft creation, starts a new account's trial.
-- Also repair missed trials using the recorded moderation approval time.
-- No rows are deleted; existing/consumed trials are never restarted.
begin;

create or replace function public.start_trial_on_first_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumed timestamptz;
begin
  if not new.accepted_by_platform then return new; end if;
  if tg_op = 'UPDATE' and old.accepted_by_platform then return new; end if;
  if new.trial_started_at is not null then return new; end if;

  insert into public.profiles (id) values (new.owner_id) on conflict (id) do nothing;
  select trial_consumed_at into v_consumed
  from public.profiles where id = new.owner_id for update;
  if v_consumed is null then
    new.trial_started_at := now();
    update public.profiles
    set trial_consumed_at = now(), trial_started_at = coalesce(trial_started_at, now())
    where id = new.owner_id;
  end if;
  return new;
end;
$$;

-- Replacing the function alone does not upgrade an old INSERT-only trigger.
drop trigger if exists trg_start_trial_on_first_business on public.businesses;
create trigger trg_start_trial_on_first_business
before insert or update of accepted_by_platform on public.businesses
for each row execute function public.start_trial_on_first_business();
revoke all on function public.start_trial_on_first_business() from public, anon, authenticated;

-- A repaired trial starts at the FIRST creation approval, never at migration
-- execution or approval of later edits. An approval older than 14 days therefore
-- remains expired. Accounts with any evidence of a previous trial are excluded,
-- including accounts whose previous business was deleted (profile ledger).
do $$
declare
  v_candidate record;
  v_consumed timestamptz;
  v_started timestamptz;
begin
  for v_candidate in
    select distinct on (b.owner_id)
      b.owner_id, b.id as business_id, m.reviewed_at as approved_at
    from public.businesses b
    join public.moderation_submissions m
      on m.business_id = b.id and m.entity_id = b.id
      and m.entity_type = 'business' and m.change_kind = 'create'
      and m.status = 'accepted' and m.reviewed_at is not null
    where b.accepted_by_platform and not b.comped
      and b.trial_started_at is null
      and not exists (
        select 1 from public.businesses previous
        where previous.owner_id = b.owner_id and previous.trial_started_at is not null
      )
    order by b.owner_id, m.reviewed_at, b.created_at, b.id
  loop
    insert into public.profiles (id) values (v_candidate.owner_id) on conflict (id) do nothing;
    select trial_consumed_at, trial_started_at into v_consumed, v_started
    from public.profiles where id = v_candidate.owner_id for update;
    if v_consumed is null and v_started is null then
      update public.businesses set trial_started_at = v_candidate.approved_at
      where id = v_candidate.business_id and trial_started_at is null;
      if found then
        update public.profiles
        set trial_consumed_at = v_candidate.approved_at, trial_started_at = v_candidate.approved_at
        where id = v_candidate.owner_id;
      end if;
    end if;
  end loop;
end;
$$;

commit;
