\set ON_ERROR_STOP on
-- NEW disposable database only. Never run fixture setup in an app database.
\ir card_usage_instructions.sql
alter table public.card_instances add column terms_accepted_version integer;
alter table public.businesses add column slug text;
\ir ../migrations/20260828120000_enforce_moderated_publication.sql
select set_config('request.jwt.claim.role', 'service_role', false);
update public.businesses set marketplace_status = 'published' where id = '20000000-0000-4000-8000-000000000001';
\ir ../migrations/20260904100000_lock_used_cards_and_hide_pending_edits.sql

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select public.test_assert((select not active from public.card_templates where id = :'approved_id'), 'Existing pending edits are hidden by migration');
select public.test_assert((select count(*) = 0 from public.get_business_cards_public('20000000-0000-4000-8000-000000000001')), 'Pending card is absent from public business profile');
select public.test_assert(not exists(select 1 from public.discover_cards() where template_id = :'approved_id'), 'Pending card is absent from Discover feed');
select public.test_assert(not exists(select 1 from public.discover_businesses() where business_id = '20000000-0000-4000-8000-000000000001'), 'Business without eligible cards disappears from Discover');
select public.test_assert(not public.card_has_customers(:'approved_id'), 'Unused card remains editable');
select public.expect_error(format('insert into public.card_instances(id, template_id, customer_id) values(gen_random_uuid(), %L, auth.uid())', :'approved_id'), 'not available');

select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003')
from public.moderation_submissions where entity_id = :'approved_id' and status = 'pending';
select public.test_assert((select active from public.card_templates where id = :'approved_id'), 'Approval restores intended active state');
select public.test_assert((select count(*) = 1 from public.get_business_cards_public('20000000-0000-4000-8000-000000000001')), 'Approved card is public again');
select public.test_assert(exists(select 1 from public.discover_cards() where template_id = :'approved_id'), 'Approved card returns to Discover');
select public.test_assert((select card_count = 1 from public.discover_businesses() where business_id = '20000000-0000-4000-8000-000000000001'), 'Discover business count includes approved cards');

-- Resubmitting while pending preserves both the intended active flag and original snapshot.
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.submit_card_changes(:'approved_id', '{"subtitle":"Pending subtitle"}');
select public.submit_card_changes(:'approved_id', '{"subtitle":"Revised pending subtitle"}');
reset role;
select public.test_assert((select not active from public.card_templates where id = :'approved_id'), 'New submission hides card atomically');
select public.test_assert((select (current_data->'card'->>'active')::boolean and (proposed_data->'card'->>'active')::boolean
  from public.moderation_submissions where entity_id = :'approved_id' and status = 'pending'), 'Resubmission retains publication intent');
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003')
from public.moderation_submissions where entity_id = :'approved_id' and status = 'pending';

-- Once owned, even an unstamped card blocks both submissions and direct writes.
insert into public.card_instances values ('30000000-0000-4000-8000-000000000001', :'approved_id', '10000000-0000-4000-8000-000000000002', 1);
alter table public.card_instances enable row level security;
grant select on public.card_instances to authenticated;
grant select, update on public.card_templates to authenticated;
-- No SELECT policy: emulate cards.manage without customers.view.
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.test_assert((select count(*) = 0 from public.card_instances), 'Customer records are hidden from this manager');
select public.test_assert(public.card_has_customers(:'approved_id'), 'Manager receives editability despite customer RLS');
select public.expect_error(format('select public.submit_card_changes(%L, ''{"title":"Not allowed"}'')', :'approved_id'), 'already used by customers');
select public.expect_error(format('update public.card_templates set title = ''Bypass'' where id = %L', :'approved_id'), 'already used by customers');
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select public.expect_error(format('update public.card_templates set usage_instructions = ''Service bypass attempt'' where id = %L', :'approved_id'), 'already used by customers');
select public.test_assert((select count(*) = 0 from public.moderation_submissions where entity_id = :'approved_id' and status = 'pending'), 'Rejected edit creates no moderation submission');
select public.test_assert((select count(*) = 1 from public.get_business_cards_public('20000000-0000-4000-8000-000000000001')), 'Blocked edit leaves published card visible');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
select public.expect_error(format('select public.card_has_customers(%L)', :'approved_id'), 'Not authorized');
select public.test_assert(not has_function_privilege('anon', 'public.card_has_customers(uuid)', 'execute'), 'Anonymous callers cannot inspect usage');
select public.test_assert(not has_function_privilege('anon', 'public.submit_card_changes(uuid,jsonb)', 'execute'), 'Anonymous edits remain denied');
select 'All card edit restriction checks passed.' as result;
