\set ON_ERROR_STOP on
-- Requires a NEW disposable database; the fixture intentionally fails if auth
-- already exists. Never run this fixture against application data.
\ir fixtures/onboarding_base.sql

create function public.test_assert(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %', message; end if; end; $$;
create function public.expect_error(statement text, expected text) returns void language plpgsql as $$
declare failed boolean := false;
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm) = 0 then raise exception 'Unexpected error: %', sqlerrm; end if;
    failed := true;
  end;
  if not failed then raise exception 'Expected error containing: %', expected; end if;
end; $$;

insert into auth.users values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
insert into public.user_roles values ('10000000-0000-4000-8000-000000000003', 'admin');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);

create function public.test_business() returns jsonb language sql as $$
  select '{"name":"Test Café","category":"Café & coffee","address_line1":"Storgata 12","city":"Oslo","postal_code":"0155","country":"Norway"}'::jsonb;
$$;
create function public.test_card() returns jsonb language sql as $$
  select '{"title":"Coffee club","total_steps":8,"rewards":[{"step":8,"label":"Free coffee"}],"terms_and_conditions":"One stamp per coffee. Redeem after eight stamps."}'::jsonb;
$$;

-- Auth, required fields, and card terms are validated before any row survives.
select set_config('request.jwt.claim.sub', '', false);
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card())$q$, 'Authentication required');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select public.expect_error($q$insert into public.businesses(owner_id,name,onboarding_completed_at) values(auth.uid(),'Incomplete business',now())$q$, 'first loyalty card');
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business() - 'city', public.test_card())$q$, 'full address');
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), null)$q$, 'first loyalty card');
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card() || '{"terms_and_conditions":"short"}')$q$, 'first loyalty card');
select public.test_assert((select count(*) = 0 from public.businesses), 'Invalid submissions create no business');

-- Fail after business insertion: all writes must roll back together.
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card(), '[{"platform":"bad","url":"javascript:alert(1)"}]')$q$, 'Invalid social link');
select public.test_assert((select count(*) = 0 from public.businesses), 'Failure rolls back business');
select public.test_assert((select count(*) = 0 from public.card_templates), 'Failure rolls back card');
select public.test_assert((select count(*) = 0 from public.notifications), 'Failure creates no notification');

set role authenticated;
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card(), '[]', 'published');
reset role;
select public.test_assert((select not accepted_by_platform and trial_started_at is null and onboarding_completed_at is not null from public.businesses), 'Pending business has no active trial');
select public.test_assert(not public.business_has_access_v2('20000000-0000-4000-8000-000000000001'), 'Pending business has no operational access');
select public.test_assert((select count(*) = 1 from public.card_templates where not accepted_by_platform), 'One private card');
select public.test_assert((select count(*) = 2 from public.moderation_submissions where status = 'pending'), 'Business and card queued once');
select public.test_assert((select count(*) = 1 from public.notifications where title = 'Business awaiting review'), 'Single business notification');
select public.test_assert((select count(*) = 1 from public.notifications where title = 'Card awaiting review'), 'Single card notification');

-- A retry uses the same business/card and does not create duplicate notifications.
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card(), '[]', 'published');
select public.test_assert((select count(*) = 1 from public.businesses), 'Retry keeps one business');
select public.test_assert((select count(*) = 1 from public.card_templates), 'Retry keeps one card');
select public.test_assert((select count(*) = 2 from public.notifications), 'Retry keeps two distinct notifications');

-- No owner can submit another owner's draft, or approve their own business.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card())$q$, 'Only the owner');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select public.expect_error($q$update public.businesses set accepted_by_platform = true$q$, 'Only the platform');
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000004', public.test_business() || '{"owner_id":"10000000-0000-4000-8000-000000000002"}', public.test_card())$q$, 'Unsupported business field');

-- Reject, revise, and resubmit the same draft; keep the rejection history.
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'rejected', '10000000-0000-4000-8000-000000000003', 'Please correct the address') from public.moderation_submissions where entity_type = 'business' and status = 'pending';
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business() || '{"address_line1":"Storgata 14"}', public.test_card());
select public.test_assert((select count(*) = 1 from public.moderation_submissions where status = 'rejected'), 'Review history preserved');
select public.test_assert((select proposed_data->'business'->>'address_line1' = 'Storgata 14' from public.moderation_submissions where entity_type = 'business' and status = 'pending'), 'Corrected data sent to review');

-- Card can be accepted first, then edited without silently changing its live version.
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003') from public.moderation_submissions where entity_type = 'card' and status = 'pending';
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card() || '{"title":"New title"}');
select public.test_assert((select title = 'Coffee club' from public.card_templates), 'Approved card unchanged until review');
select public.test_assert((select proposed_data->'card'->>'title' = 'New title' from public.moderation_submissions where entity_type = 'card' and status = 'pending'), 'Card changes staged');

-- Approval activates the business and starts its trial at approval, not submission.
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003') from public.moderation_submissions where entity_type = 'business' and status = 'pending';
select public.test_assert((select accepted_by_platform and trial_started_at is not null from public.businesses), 'Approval activates trial');
select public.test_assert(public.business_has_access_v2('20000000-0000-4000-8000-000000000001'), 'Approved business has trial access');
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000001', public.test_business(), public.test_card())$q$, 'already approved');

-- A second pending draft must not consume a seat or steal the first trial.
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000002', public.test_business(), public.test_card());
select public.test_assert(public.business_slot_rank('20000000-0000-4000-8000-000000000001') = 1, 'Pending drafts excluded from seat rank');
select public.test_assert((select trial_started_at is null from public.businesses where id = '20000000-0000-4000-8000-000000000002'), 'Second draft has no trial');
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000002', public.test_business(), public.test_card(), '[]', 'unpublished', (select id from public.card_templates where business_id = '20000000-0000-4000-8000-000000000001'))$q$, 'Card does not belong');

select public.test_assert(not has_function_privilege('anon', 'public.submit_business_onboarding(uuid,jsonb,jsonb,jsonb,text,uuid)', 'execute'), 'Anonymous submission denied');
select public.test_assert(has_function_privilege('authenticated', 'public.submit_business_onboarding(uuid,jsonb,jsonb,jsonb,text,uuid)', 'execute'), 'Authenticated RPC granted');
select 'All onboarding database regression checks passed.' as result;
