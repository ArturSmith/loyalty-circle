\set ON_ERROR_STOP on
-- Fresh disposable database only. Imports the existing isolated fixtures.
\ir business_onboarding_review.sql
alter table public.businesses add column paused_at timestamptz;
alter table public.card_templates add column terms_version integer not null default 1;
\ir ../migrations/20260828140000_public_business_cards.sql
\ir ../migrations/20260903100000_card_usage_instructions.sql
select id from public.card_templates where business_id = '20000000-0000-4000-8000-000000000001' \gset approved_

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000002', public.test_business(),
  public.test_card() || '{"usage_instructions":"Show My QR in Wallet. After step 7 you will get voucher for Free coffee."}');
reset role;
select public.test_assert((select usage_instructions like 'Show My QR%' and terms_and_conditions = public.test_card()->>'terms_and_conditions'
  from public.card_templates where business_id = '20000000-0000-4000-8000-000000000002'), 'Onboarding saves usage separately from terms');
select public.test_assert((select proposed_data->'card'->>'usage_instructions' like 'Show My QR%'
  from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000002' and entity_type = 'card' and status = 'pending'), 'Usage included in review snapshot');
select public.test_assert((select count(*) = 0 from public.get_business_cards_public('20000000-0000-4000-8000-000000000002')), 'Draft usage is not public');

set role authenticated;
select public.submit_business_onboarding('20000000-0000-4000-8000-000000000005', public.test_business(),
  public.test_card() || '{"usage_instructions":"Instructions generated for a brand new first card."}');
reset role;
select public.test_assert((select usage_instructions = 'Instructions generated for a brand new first card.'
  from public.card_templates where business_id = '20000000-0000-4000-8000-000000000005'), 'New onboarding insertion retains usage');
insert into public.card_templates(business_id, title, terms_and_conditions, usage_instructions)
  values ('20000000-0000-4000-8000-000000000005', 'Standalone card', public.test_card()->>'terms_and_conditions', 'Standalone card usage instructions.');
select public.test_assert((select proposed_data->'card'->>'usage_instructions' = 'Standalone card usage instructions.'
  from public.moderation_submissions where entity_id = (select id from public.card_templates where title = 'Standalone card') and status = 'pending'), 'Standalone card usage queued for review');

-- Existing approved card: change usage only; live terms and usage wait for review.
set role authenticated;
select public.submit_card_changes(:'approved_id', '{"usage_instructions":"Open My QR in Wallet and ask staff to scan it."}')
;
reset role;
select public.test_assert((select usage_instructions is null and terms_version = 1
  from public.card_templates where business_id = '20000000-0000-4000-8000-000000000001'), 'Unapproved AI copy does not replace published data');
select public.expect_error($q$update public.card_templates set usage_instructions = 'Bypass moderation instructions.' where accepted_by_platform$q$, 'Card changes must be submitted');

select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'accepted', '10000000-0000-4000-8000-000000000003')
  from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000001' and entity_type = 'card' and status = 'pending';
set role anon;
select public.test_assert((select usage_instructions = 'Open My QR in Wallet and ask staff to scan it.'
  and terms_and_conditions = public.test_card()->>'terms_and_conditions' and terms_version = 1
  from public.get_business_cards_public('20000000-0000-4000-8000-000000000001')), 'Public RPC exposes approved instructions without modifying terms');
reset role;

select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.submit_card_changes(:'approved_id', '{"usage_instructions":"Updated usage awaiting moderator approval."}')
;
reset role;
select public.test_assert((select current_data->'card'->>'usage_instructions' = 'Open My QR in Wallet and ask staff to scan it.'
  and proposed_data->'card'->>'usage_instructions' = 'Updated usage awaiting moderator approval.'
  from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000001' and entity_type = 'card' and status = 'pending'), 'Moderator compares current and proposed usage');
select set_config('request.jwt.claim.role', 'service_role', false);
select public.review_moderation_submission(id, 'rejected', '10000000-0000-4000-8000-000000000003', 'Please revise the usage instructions')
  from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000001' and entity_type = 'card' and status = 'pending';
select public.test_assert((select usage_instructions = 'Open My QR in Wallet and ask staff to scan it.'
  from public.get_business_cards_public('20000000-0000-4000-8000-000000000001')), 'Rejection keeps approved copy');

-- Older clients editing reward configuration must not preserve stale AI copy.
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.submit_card_changes(:'approved_id', '{"total_steps":10}')
;
reset role;
select public.test_assert((select proposed_data->'card'->>'usage_instructions' is null
  from public.moderation_submissions where business_id = '20000000-0000-4000-8000-000000000001' and entity_type = 'card' and status = 'pending'), 'Changing card facts clears stale copy');
select public.expect_error($q$select public.submit_card_changes((select id from public.card_templates limit 1), '{"usage_instructions":"bad"}')$q$, 'Invalid card usage');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
select public.expect_error($q$select public.submit_card_changes((select id from public.card_templates limit 1), '{"usage_instructions":"Cross-business instructions."}')$q$, 'Not authorized');
select public.test_assert(not has_function_privilege('anon', 'public.submit_card_changes(uuid,jsonb)', 'execute'), 'Anonymous mutation remains denied');
select public.test_assert(has_function_privilege('authenticated', 'public.submit_business_onboarding(uuid,jsonb,jsonb,jsonb,text,uuid)', 'execute'), 'Onboarding grant preserved');
select 'All card usage database regression checks passed.' as result;
