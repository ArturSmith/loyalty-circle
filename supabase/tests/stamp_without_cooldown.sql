\set ON_ERROR_STOP on
-- NEW disposable PostgreSQL database only, never a live Supabase project.
\ir fixtures/onboarding_base.sql

alter table public.profiles add column display_name text, add column avatar_url text;
alter table public.card_instances add column stamps_count integer not null default 0, add column completed_at timestamptz, add column created_at timestamptz default now();
alter table public.stamps add column issued_by uuid;
alter table public.stamps alter column id set default gen_random_uuid();
create table public.vouchers (
  id uuid primary key default gen_random_uuid(), card_instance_id uuid, template_id uuid,
  business_id uuid, customer_id uuid, step_number integer, label text,
  status text default 'unused', redeemed_at timestamptz, redeemed_by uuid
);
create table public.test_staff (business_id uuid, user_id uuid, can_stamp boolean);
create or replace function public.has_business_permission(_business_id uuid, _user_id uuid, _permission text)
returns boolean language sql security definer as $$
  select public.is_business_member(_business_id, _user_id) or exists (
    select 1 from public.test_staff where business_id = _business_id and user_id = _user_id and can_stamp and _permission = 'cards.stamp'
  );
$$;
create function public.can_on_template(_template_id uuid, _permission text) returns boolean language sql as $$
  select public.has_business_permission(business_id, auth.uid(), _permission) from public.card_templates where id = _template_id;
$$;
\ir ../migrations/20260826200000_scope_staff_operations_to_business_permissions.sql
\ir ../migrations/20260830150000_customer_qr_stamping.sql
\ir ../migrations/20260831211500_allow_admin_card_stamping.sql

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
 ('10000000-0000-4000-8000-000000000001'), ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003'), ('10000000-0000-4000-8000-000000000004');
select set_config('request.jwt.claim.role', 'service_role', false);
insert into public.businesses (id, owner_id, name, accepted_by_platform) values
 ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Test café', true),
 ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Expired café', true);
update public.businesses set trial_started_at = now() - interval '30 days' where id = '20000000-0000-4000-8000-000000000002';
insert into public.test_staff values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', true);
insert into public.card_templates (id, business_id, title, total_steps, rewards, terms_and_conditions, accepted_by_platform) values
 ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Rewards', 5, '[{"step":3,"label":"Small reward"},{"step":5,"label":"Final reward"}]', 'Test terms and conditions.', true),
 ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Plain card', 32, '[]', 'Test terms and conditions.', true),
 ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Expired card', 5, '[]', 'Test terms and conditions.', true);
insert into public.card_instances (id, template_id, customer_id) values
 ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004'),
 ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004'),
 ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
set role authenticated;
select public.stamp_business_card('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
select public.expect_error($q$select public.stamp_business_card('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')$q$, 'please wait');
reset role;

\ir ../migrations/20260902200000_remove_stamp_cooldown.sql
\ir ../migrations/20260902200000_remove_stamp_cooldown.sql
select public.test_assert((select count(*) = 1 from public.stamps), 'Migration preserves stamp history');

-- No sleeps: rapid owner and administrator stamps succeed and rewards advance once.
set role authenticated;
select public.stamp_business_card('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
select public.stamp_business_card('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001');
select public.expect_error($q$select public.stamp_business_card('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')$q$, 'card is full');
reset role;
select public.test_assert((select stamps_count = 5 and completed_at is not null from public.card_instances where id = '40000000-0000-4000-8000-000000000001'), 'Progress completes including reward steps');
select public.test_assert((select array_agg(step_number order by step_number) = array[1,2,4] from public.stamps where card_instance_id = '40000000-0000-4000-8000-000000000001'), 'Paid stamps advance exactly once');
select public.test_assert((select array_agg(step_number order by step_number) = array[3,5] from public.vouchers), 'Each reward issued exactly once');

-- Legacy APIs delegate to the same no-delay flow while staying owner-only.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
set role authenticated;
select public.add_stamp('40000000-0000-4000-8000-000000000002'::uuid);
select public.add_stamp('40000000-0000-4000-8000-000000000002'::uuid, 'live');
select public.expect_error($q$select public.stamp_business_card('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002')$q$, 'not authorized');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', false);
select public.expect_error($q$select public.add_stamp('40000000-0000-4000-8000-000000000002'::uuid, 'live')$q$, 'not authorized');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', false);
select public.expect_error($q$select public.stamp_business_card('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$q$, 'not authorized');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', false);
select public.expect_error($q$select public.stamp_business_card('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002')$q$, 'subscription required');
select set_config('request.jwt.claim.sub', '', false);
select public.expect_error($q$select public.stamp_business_card('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$q$, 'auth required');
reset role;
select public.test_assert(not has_function_privilege('anon', 'public.stamp_business_card(uuid,uuid,text)', 'execute'), 'Anonymous stamping stays denied');
select 'All no-cooldown stamping checks passed.' as result;
