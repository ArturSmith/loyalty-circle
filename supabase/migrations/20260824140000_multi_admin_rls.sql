-- Multi-administrator access.
--
-- Until now every business-side RLS policy asked the same question:
-- "is auth.uid() the owner of this business?". That makes an invited admin
-- invisible to the entire product — they can log in and see nothing.
--
-- This migration replaces those checks with a permission-aware one, so a
-- member sees exactly what the owner granted them and nothing more.
--
-- Two rules are enforced structurally rather than by convention:
--   1. The owner always passes every check (they cannot lock themselves out).
--   2. An admin passes only if the matching permission is on their membership
--      row AND their status is 'active'. A revoked admin fails instantly.
--
-- Permission strings mirror src/lib/plans.ts — keep the two in step.

/* ------------------------------------------------------------------ helper */

create or replace function public.has_business_permission(
  _business_id uuid,
  _user_id uuid,
  _permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    -- The owner holds every permission implicitly.
    select 1 from public.businesses b
    where b.id = _business_id and b.owner_id = _user_id
  ) or exists (
    select 1 from public.business_members m
    where m.business_id = _business_id
      and m.user_id = _user_id
      and m.status = 'active'
      and (
        m.role = 'owner'
        or _permission = any (m.permissions)
      )
  );
$$;

revoke all on function public.has_business_permission(uuid, uuid, text) from public, anon;
grant execute on function public.has_business_permission(uuid, uuid, text) to authenticated, service_role;

-- Convenience wrapper for the common "business_id lives on this row" case.
create or replace function public.can_on_business(_business_id uuid, _permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_business_permission(_business_id, auth.uid(), _permission);
$$;

revoke all on function public.can_on_business(uuid, text) from public, anon;
grant execute on function public.can_on_business(uuid, text) to authenticated, service_role;

-- Same question, but starting from a card template.
create or replace function public.can_on_template(_template_id uuid, _permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.card_templates t
    where t.id = _template_id
      and public.has_business_permission(t.business_id, auth.uid(), _permission)
  );
$$;

revoke all on function public.can_on_template(uuid, text) from public, anon;
grant execute on function public.can_on_template(uuid, text) to authenticated, service_role;

/* -------------------------------------------------------------- businesses */

-- Members may read the business they belong to. Editing the business record
-- itself stays with the owner: it carries billing identity and the marketplace
-- listing, and no admin permission currently covers it.
drop policy if exists "Members read their business" on public.businesses;
create policy "Members read their business" on public.businesses
  for select to authenticated
  using (public.is_business_member(id, auth.uid()));

/* ---------------------------------------------------------- card_templates */

drop policy if exists "Owners manage templates" on public.card_templates;
create policy "Members manage templates" on public.card_templates
  for all to authenticated
  using (public.can_on_business(business_id, 'cards.manage'))
  with check (public.can_on_business(business_id, 'cards.manage'));

/* ------------------------------------------------------------------ stamps */

drop policy if exists "Owners insert stamps" on public.stamps;
create policy "Members insert stamps" on public.stamps
  for insert to authenticated
  with check (
    issued_by = auth.uid()
    and public.can_on_business(business_id, 'cards.stamp')
  );

/* ---------------------------------------------------------- card_instances */

-- Stamping updates the instance, so this is the stamp permission, not manage.
drop policy if exists "Owners update business instances" on public.card_instances;
create policy "Members update business instances" on public.card_instances
  for update to authenticated
  using (public.can_on_template(template_id, 'cards.stamp'))
  with check (public.can_on_template(template_id, 'cards.stamp'));

-- Removing a customer's card is destructive — require the manage permission.
drop policy if exists "Owners delete business instances" on public.card_instances;
create policy "Members delete business instances" on public.card_instances
  for delete to authenticated
  using (public.can_on_template(template_id, 'cards.manage'));

/* ---------------------------------------------------------------- vouchers */

drop policy if exists "Owners read business vouchers" on public.vouchers;
create policy "Members read business vouchers" on public.vouchers
  for select to authenticated
  using (public.can_on_business(business_id, 'customers.view'));

drop policy if exists "Owners issue vouchers" on public.vouchers;
create policy "Members issue vouchers" on public.vouchers
  for insert to authenticated
  with check (public.can_on_business(business_id, 'cards.stamp'));

drop policy if exists "Owners redeem vouchers" on public.vouchers;
create policy "Members redeem vouchers" on public.vouchers
  for update to authenticated
  using (public.can_on_business(business_id, 'cards.stamp'))
  with check (public.can_on_business(business_id, 'cards.stamp'));

/* ------------------------------------------------------------- card_events */

drop policy if exists "Owners read business events" on public.card_events;
create policy "Members read business events" on public.card_events
  for select to authenticated
  using (public.can_on_business(business_id, 'analytics.view'));

/* ------------------------------------------------------ wallet_pass_events */

drop policy if exists "Owners read wallet pass events" on public.wallet_pass_events;
create policy "Members read wallet pass events" on public.wallet_pass_events
  for select to authenticated
  using (
    exists (
      select 1 from public.card_templates t
      where t.id = wallet_pass_events.template_id
        and public.has_business_permission(t.business_id, auth.uid(), 'analytics.view')
    )
  );

/* ---------------------------------------------------------------- profiles */

-- Customer profiles are personal data, so this is gated on customers.view
-- rather than mere membership.
drop policy if exists "Customers visible to their business owners" on public.profiles;
create policy "Customers visible to their business staff" on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.card_instances ci
    join public.card_templates t on t.id = ci.template_id
    where ci.customer_id = profiles.id
      and public.has_business_permission(t.business_id, auth.uid(), 'customers.view')
  ));

/* ----------------------------------------------------------------- chats */

-- Widen participation to permitted members so staff can answer customers.
create or replace function public.is_conversation_participant(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = _conversation_id
      and (
        c.customer_id = auth.uid()
        or public.has_business_permission(c.business_id, auth.uid(), 'customers.message')
      )
  )
$$;

drop policy if exists "Participants read conversations" on public.conversations;
create policy "Participants read conversations" on public.conversations
  for select to authenticated
  using (
    customer_id = auth.uid()
    or public.can_on_business(business_id, 'customers.message')
  );

drop policy if exists "Participants send messages" on public.chat_messages;
create policy "Participants send messages" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and (
      (sender_role = 'customer' and exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.customer_id = auth.uid()))
      or
      (sender_role = 'business' and exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and public.has_business_permission(c.business_id, auth.uid(), 'customers.message')))
    )
  );

/* ------------------------------------------------------- owner memberships */

-- The backfill in the previous migration created owner rows with an empty
-- permissions array. That is harmless because has_business_permission()
-- short-circuits on role = 'owner', but fill it in so the members UI shows the
-- owner as fully privileged rather than as an admin with no rights.
update public.business_members
set permissions = array[
  'cards.manage','cards.stamp','customers.view','customers.message',
  'analytics.view','locations.manage','marketplace.manage','billing.manage'
]
where role = 'owner' and permissions = '{}';
