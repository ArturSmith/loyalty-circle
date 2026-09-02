\set ON_ERROR_STOP on
-- NEW disposable PostgreSQL database ONLY. Imports the onboarding fixture/tests.
\ir business_onboarding_review.sql

-- Reproduce a partial rollout: approval-aware function but INSERT-only trigger.
drop trigger trg_start_trial_on_first_business on public.businesses;
create trigger trg_start_trial_on_first_business before insert on public.businesses
for each row execute function public.start_trial_on_first_business();

create function public.test_approved_business(_owner uuid, _business uuid, _age interval default interval '2 hours')
returns void language plpgsql as $$
begin
  insert into auth.users values (_owner) on conflict do nothing;
  perform set_config('request.jwt.claim.sub', _owner::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform public.submit_business_onboarding(_business, public.test_business(), public.test_card());
  perform set_config('request.jwt.claim.role', 'service_role', false);
  perform public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003')
  from public.moderation_submissions where business_id = _business and entity_type = 'business' and status = 'pending';
  -- Only the isolated test fixture backdates the review to exercise expiry.
  update public.moderation_submissions set reviewed_at = now() - _age
  where business_id = _business and entity_type = 'business' and status = 'accepted';
end;
$$;

select public.test_approved_business('10000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000010');
select public.test_assert(not public.business_has_access_v2('20000000-0000-4000-8000-000000000010'), 'Reproduces approved new account without trial access');
select public.test_approved_business('10000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000011', interval '30 days');

-- Permanent ledger protects owners even if the previous business was deleted.
select public.test_approved_business('10000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000012');
insert into public.profiles (id, trial_consumed_at) values ('10000000-0000-4000-8000-000000000012', now() - interval '50 days');
-- Legacy profile trial evidence must also prevent backfill.
select public.test_approved_business('10000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000013');
insert into public.profiles (id, trial_started_at) values ('10000000-0000-4000-8000-000000000013', now() - interval '50 days');

-- Only the earliest creation approval gets repaired for a multi-business owner.
select public.test_approved_business('10000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000014', interval '4 days');
select public.test_approved_business('10000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000015', interval '1 day');
-- Existing business trial is evidence even if its profile ledger is missing.
select public.test_approved_business('10000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000016');
update public.businesses set trial_started_at = now() - interval '40 days' where id = '20000000-0000-4000-8000-000000000016';
select public.test_approved_business('10000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000017');

-- No inferred dates for comped businesses or businesses without creation approval.
select public.test_approved_business('10000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000018');
update public.businesses set comped = true where id = '20000000-0000-4000-8000-000000000018';
select public.test_approved_business('10000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000019');
update public.moderation_submissions set change_kind = 'update' where business_id = '20000000-0000-4000-8000-000000000019' and entity_type = 'business';

-- Fresh pending and rejected drafts still receive no trial.
insert into auth.users values ('10000000-0000-4000-8000-000000000020');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000020', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000020', public.test_business(), public.test_card());
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000021', public.test_business(), public.test_card());
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'rejected', '10000000-0000-4000-8000-000000000003', 'Fix address')
from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000021' and entity_type = 'business';

create temporary table original_trials as select id, trial_started_at from public.businesses where trial_started_at is not null;
create temporary table original_reviews as select * from public.moderation_submissions;
create temporary table original_notifications as select * from public.notifications;

-- Migrations run as the database owner without an authenticated app JWT.
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', '', false);
\ir ../migrations/20260902170000_repair_approval_trials.sql

select public.test_assert(public.business_has_access_v2('20000000-0000-4000-8000-000000000010'), 'Repaired fresh account has trial access');
select public.test_assert((select b.trial_started_at = m.reviewed_at and p.trial_consumed_at = m.reviewed_at and p.trial_started_at = m.reviewed_at
  from public.businesses b join public.profiles p on p.id = b.owner_id
  join public.moderation_submissions m on m.entity_id = b.id and m.entity_type = 'business'
  where b.id = '20000000-0000-4000-8000-000000000010'), 'Trial and ledger use actual approval timestamp');
select public.test_assert(not public.business_has_access_v2('20000000-0000-4000-8000-000000000011'), 'Old missed trial remains expired');
select public.test_assert((select trial_started_at is not null from public.businesses where id = '20000000-0000-4000-8000-000000000014'), 'Earliest approved business receives trial');
select public.test_assert(not exists (select 1 from public.businesses where id in (
  '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000013',
  '20000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000017',
  '20000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000019',
  '20000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000021'
) and trial_started_at is not null), 'Consumed, legacy, second, comped, unproven, pending and rejected trials untouched');
select public.test_assert(not exists (select 1 from original_trials o left join public.businesses b using(id) where b.trial_started_at is distinct from o.trial_started_at), 'Existing trial dates unchanged');
select public.test_assert(not exists ((select * from original_reviews except select * from public.moderation_submissions) union all (select * from public.moderation_submissions except select * from original_reviews)), 'Moderation history unchanged');
select public.test_assert(not exists ((select * from original_notifications except select * from public.notifications) union all (select * from public.notifications except select * from original_notifications)), 'No duplicate notifications');

-- Re-running the repair must not extend trials or consume more accounts.
create temporary table repaired_businesses as select * from public.businesses;
create temporary table repaired_profiles as select * from public.profiles;
\ir ../migrations/20260902170000_repair_approval_trials.sql
select public.test_assert(not exists ((select * from repaired_businesses except select * from public.businesses) union all (select * from public.businesses except select * from repaired_businesses)), 'Business backfill is idempotent');
select public.test_assert(not exists ((select * from repaired_profiles except select * from public.profiles) union all (select * from public.profiles except select * from repaired_profiles)), 'Profile backfill is idempotent');

-- The repaired trigger handles future approvals, not only existing records.
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003')
from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000020' and entity_type = 'business';
select public.test_assert(public.business_has_access_v2('20000000-0000-4000-8000-000000000020'), 'Future approval starts trial');
select public.test_assert((select b.trial_started_at = m.reviewed_at from public.businesses b join public.moderation_submissions m on m.entity_id = b.id and m.entity_type = 'business' where b.id = '20000000-0000-4000-8000-000000000020'), 'Future trial starts exactly at approval');
create temporary table first_trial as select trial_started_at from public.businesses where id = '20000000-0000-4000-8000-000000000020';
update public.businesses set accepted_by_platform = true where id = '20000000-0000-4000-8000-000000000020';
select public.test_assert((select b.trial_started_at = t.trial_started_at from public.businesses b cross join first_trial t where b.id = '20000000-0000-4000-8000-000000000020'), 'Later approval updates never restart trial');
select public.test_approved_business('10000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000022');
select public.test_assert((select trial_started_at is null from public.businesses where id = '20000000-0000-4000-8000-000000000022'), 'Second approval does not grant another trial');
select public.test_assert(not has_function_privilege('authenticated', 'public.start_trial_on_first_business()', 'execute'), 'Trial trigger is not directly callable by clients');
select 'All approval trial repair checks passed.' as result;
