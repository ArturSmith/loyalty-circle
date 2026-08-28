-- Two notification audiences share one event stream. Business notifications
-- are visible to every active member of that business, while customer
-- notifications belong to one user. Reads are stored separately so one team
-- member cannot clear another team member's unread badge.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('business', 'customer')),
  business_id uuid references public.businesses(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  constraint notifications_audience_target_check check (
    (audience = 'business' and business_id is not null and recipient_id is null)
    or
    (audience = 'customer' and recipient_id is not null and business_id is null)
  )
);

create index if not exists notifications_business_feed_idx
  on public.notifications(business_id, created_at desc)
  where audience = 'business';
create index if not exists notifications_customer_feed_idx
  on public.notifications(recipient_id, created_at desc)
  where audience = 'customer';

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notification_reads_user_idx
  on public.notification_reads(user_id, read_at desc);

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

grant select on public.notifications to authenticated;
grant select, insert, update on public.notification_reads to authenticated;
grant all on public.notifications to service_role;
grant all on public.notification_reads to service_role;

drop policy if exists "Users read scoped notifications" on public.notifications;
create policy "Users read scoped notifications" on public.notifications
  for select to authenticated
  using (
    (audience = 'customer' and recipient_id = auth.uid())
    or
    (audience = 'business' and public.is_business_member(business_id, auth.uid()))
  );

drop policy if exists "Users read own notification state" on public.notification_reads;
create policy "Users read own notification state" on public.notification_reads
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users create own notification state" on public.notification_reads;
create policy "Users create own notification state" on public.notification_reads
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.notifications n
      where n.id = notification_id
        and (
          (n.audience = 'customer' and n.recipient_id = auth.uid())
          or
          (n.audience = 'business' and public.is_business_member(n.business_id, auth.uid()))
        )
    )
  );

drop policy if exists "Users update own notification state" on public.notification_reads;
create policy "Users update own notification state" on public.notification_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/* ------------------------------------------ moderation/business events */

create or replace function public.notify_moderation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_title text;
  v_body text;
  v_action_url text;
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.submitted_at is not distinct from old.submitted_at
     and new.rejection_reason is not distinct from old.rejection_reason then
    return new;
  end if;

  v_name := coalesce(
    case new.entity_type
      when 'business' then new.proposed_data->'business'->>'name'
      when 'card' then new.proposed_data->'card'->>'title'
    end,
    case new.entity_type when 'business' then 'Business' else 'Loyalty card' end
  );

  if new.status = 'pending' then
    v_title := case
      when new.entity_type = 'business' and new.change_kind = 'create' then 'Business awaiting review'
      when new.entity_type = 'business' then 'Business changes awaiting review'
      when new.change_kind = 'create' then 'Card awaiting review'
      else 'Card changes awaiting review'
    end;
    v_body := v_name || ' was submitted to the platform moderation team.';
  elsif new.status = 'rejected' then
    v_title := case new.entity_type
      when 'business' then 'Business changes rejected'
      else 'Card changes rejected'
    end;
    v_body := coalesce(
      nullif(btrim(new.rejection_reason), ''),
      v_name || ' was not accepted. Update the details and submit it again.'
    );
  elsif new.status = 'accepted' then
    v_title := case new.entity_type
      when 'business' then 'Business changes accepted'
      else 'Card changes accepted'
    end;
    v_body := v_name || ' has been accepted and published.';
  else
    return new;
  end if;

  v_action_url := case new.entity_type
    when 'business' then '/business/edit?businessId=' || new.business_id::text
    else '/business/cards/' || new.entity_id::text || '?businessId=' || new.business_id::text
  end;

  insert into public.notifications (
    audience, business_id, event_type, title, body, action_url, metadata, dedupe_key, created_at
  ) values (
    'business',
    new.business_id,
    'moderation_' || new.status,
    v_title,
    v_body,
    v_action_url,
    jsonb_build_object(
      'moderation_submission_id', new.id,
      'entity_type', new.entity_type,
      'entity_id', new.entity_id,
      'change_kind', new.change_kind,
      'status', new.status
    ),
    'moderation:' || new.id::text || ':' || new.status || ':' || extract(epoch from new.updated_at)::text,
    coalesce(new.updated_at, now())
  ) on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists moderation_notifications_trg on public.moderation_submissions;
create trigger moderation_notifications_trg
after insert or update of status, submitted_at, rejection_reason
on public.moderation_submissions
for each row execute function public.notify_moderation_change();

-- Bring the statuses that used to live on the dashboard into the new inbox.
insert into public.notifications (
  audience, business_id, event_type, title, body, action_url, metadata, dedupe_key, created_at
)
select
  'business',
  s.business_id,
  'moderation_' || s.status,
  case
    when s.status = 'rejected' and s.entity_type = 'business' then 'Business changes rejected'
    when s.status = 'rejected' then 'Card changes rejected'
    when s.entity_type = 'business' and s.change_kind = 'create' then 'Business awaiting review'
    when s.entity_type = 'business' then 'Business changes awaiting review'
    when s.change_kind = 'create' then 'Card awaiting review'
    else 'Card changes awaiting review'
  end,
  case
    when s.status = 'rejected' then coalesce(
      nullif(btrim(s.rejection_reason), ''),
      'The submission was not accepted. Update the details and submit it again.'
    )
    else coalesce(
      case s.entity_type
        when 'business' then s.proposed_data->'business'->>'name'
        else s.proposed_data->'card'->>'title'
      end,
      case s.entity_type when 'business' then 'Business' else 'Loyalty card' end
    ) || ' was submitted to the platform moderation team.'
  end,
  case s.entity_type
    when 'business' then '/business/edit?businessId=' || s.business_id::text
    else '/business/cards/' || s.entity_id::text || '?businessId=' || s.business_id::text
  end,
  jsonb_build_object(
    'moderation_submission_id', s.id,
    'entity_type', s.entity_type,
    'entity_id', s.entity_id,
    'change_kind', s.change_kind,
    'status', s.status
  ),
  'moderation-backfill:' || s.id::text || ':' || s.status,
  coalesce(s.updated_at, s.submitted_at)
from public.moderation_submissions s
where s.status in ('pending', 'rejected')
on conflict (dedupe_key) do nothing;

/* ----------------------------------------------- customer card events */

create or replace function public.notify_customer_card_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_title text;
  v_business_name text;
begin
  -- Anonymous cards are claimed later, when customer_id changes from null to
  -- the authenticated customer. Do not let a notification constraint block
  -- creation of the anonymous card.
  if new.customer_id is null then return new; end if;

  select t.title, b.name
  into v_card_title, v_business_name
  from public.card_templates t
  join public.businesses b on b.id = t.business_id
  where t.id = new.template_id;

  insert into public.notifications (
    audience, recipient_id, event_type, title, body, action_url, metadata, dedupe_key
  ) values (
    'customer',
    new.customer_id,
    'card_added',
    'Card added to your wallet',
    coalesce(v_card_title, 'Your loyalty card') || ' from ' || coalesce(v_business_name, 'a business') || ' is ready to use.',
    '/wallet',
    jsonb_build_object('card_instance_id', new.id, 'template_id', new.template_id),
    'card-added:' || new.id::text
  ) on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists customer_card_added_notification_trg on public.card_instances;
create trigger customer_card_added_notification_trg
after insert or update of customer_id on public.card_instances
for each row execute function public.notify_customer_card_added();

create or replace function public.notify_customer_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_template_id uuid;
  v_card_title text;
  v_business_name text;
  v_reward_label text;
begin
  select ci.customer_id, t.id, t.title, b.name,
         (
           select reward->>'label'
           from jsonb_array_elements(coalesce(t.rewards, '[]'::jsonb)) reward
           where (reward->>'step')::integer = new.step_number
           limit 1
         )
  into v_customer_id, v_template_id, v_card_title, v_business_name, v_reward_label
  from public.card_instances ci
  join public.card_templates t on t.id = ci.template_id
  join public.businesses b on b.id = t.business_id
  where ci.id = new.card_instance_id;

  if v_customer_id is null then return new; end if;

  insert into public.notifications (
    audience, recipient_id, event_type, title, body, action_url, metadata, dedupe_key, created_at
  ) values (
    'customer',
    v_customer_id,
    case when v_reward_label is null then 'stamp_added' else 'reward_unlocked' end,
    case when v_reward_label is null then 'New loyalty stamp' else 'Reward unlocked' end,
    case
      when v_reward_label is null then
        coalesce(v_business_name, 'A business') || ' added stamp ' || new.step_number::text || ' to ' || coalesce(v_card_title, 'your card') || '.'
      else
        v_reward_label || ' is now available on ' || coalesce(v_card_title, 'your loyalty card') || '.'
    end,
    '/wallet',
    jsonb_build_object(
      'card_instance_id', new.card_instance_id,
      'template_id', v_template_id,
      'business_id', new.business_id,
      'step_number', new.step_number,
      'reward_label', v_reward_label
    ),
    'stamp:' || new.id::text,
    new.created_at
  ) on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists customer_stamp_notification_trg on public.stamps;
create trigger customer_stamp_notification_trg
after insert on public.stamps
for each row execute function public.notify_customer_stamp();

revoke all on function public.notify_moderation_change() from public, anon, authenticated;
revoke all on function public.notify_customer_card_added() from public, anon, authenticated;
revoke all on function public.notify_customer_stamp() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
