\set ON_ERROR_STOP on
-- Run ONLY in a NEW disposable PostgreSQL database, never a real project.
\ir business_onboarding_review.sql

-- Reproduce the reported deployment state: the RPC exists, but cannot be run
-- by a signed-in client. Check the actual invocation, not just catalog flags.
revoke execute on function public.submit_business_onboarding(uuid,jsonb,jsonb,jsonb,text,uuid) from authenticated;
set role authenticated;
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000004', public.test_business(), public.test_card())$q$, 'permission denied for function submit_business_onboarding');
reset role;

\ir ../migrations/20260902190000_fix_onboarding_execute_privilege.sql
\ir ../migrations/20260902190000_fix_onboarding_execute_privilege.sql

select public.test_assert(has_function_privilege('authenticated', 'public.submit_business_onboarding(uuid,jsonb,jsonb,jsonb,text,uuid)', 'execute'), 'Signed-in role can execute onboarding');
select public.test_assert(not has_function_privilege('anon', 'public.submit_business_onboarding(uuid,jsonb,jsonb,jsonb,text,uuid)', 'execute'), 'Anonymous role cannot execute onboarding');

-- An anonymous caller stays blocked even with a forged uid setting.
set role anon;
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000004', public.test_business(), public.test_card())$q$, 'permission denied for function submit_business_onboarding');
reset role;

-- The function's own auth check also rejects an authenticated role without a uid.
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000004', public.test_business(), public.test_card())$q$, 'Authentication required');
reset role;

insert into auth.users values ('10000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000004', public.test_business(), public.test_card());
select public.expect_error($q$select public.submit_business_onboarding('20000000-0000-4000-8000-000000000002', public.test_business(), public.test_card())$q$, 'Only the owner');
reset role;
select public.test_assert((select owner_id = '10000000-0000-4000-8000-000000000004' and not accepted_by_platform and trial_started_at is null from public.businesses where id = '20000000-0000-4000-8000-000000000004'), 'Repaired client submission creates an owned private draft with no trial');
select public.test_assert((select count(*) = 1 from public.card_templates where business_id = '20000000-0000-4000-8000-000000000004' and not accepted_by_platform), 'First card is queued, not published');
select public.test_assert((select count(*) = 2 from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000004' and status = 'pending'), 'Both business and card require moderation');
select 'All onboarding permission repair checks passed.' as result;
