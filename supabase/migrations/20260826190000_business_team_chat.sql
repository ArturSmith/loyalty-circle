-- Internal collaboration chat. This is deliberately separate from customer
-- conversations: both its audience and its access rules are business staff.
create table public.business_team_threads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('group', 'direct')),
  member_a uuid references auth.users(id) on delete cascade,
  member_b uuid references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (kind = 'group' and member_a is null and member_b is null)
    or (kind = 'direct' and member_a is not null and member_b is not null and member_a <> member_b)
  )
);

create unique index business_team_group_thread_idx
  on public.business_team_threads (business_id) where kind = 'group';
create unique index business_team_direct_thread_idx
  on public.business_team_threads (business_id, least(member_a, member_b), greatest(member_a, member_b))
  where kind = 'direct';

create table public.business_team_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.business_team_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index business_team_messages_thread_idx on public.business_team_messages (thread_id, created_at);

alter table public.business_team_threads enable row level security;
alter table public.business_team_messages enable row level security;

create or replace function public.can_access_business_team_thread(_thread_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_team_threads t
    where t.id = _thread_id
      and public.is_business_member(t.business_id, _user_id)
      and (t.kind = 'group' or _user_id in (t.member_a, t.member_b))
  );
$$;
revoke all on function public.can_access_business_team_thread(uuid, uuid) from public, anon;
grant execute on function public.can_access_business_team_thread(uuid, uuid) to authenticated, service_role;

create policy "Team reads its threads" on public.business_team_threads for select to authenticated
  using (public.is_business_member(business_id, auth.uid()) and (kind = 'group' or auth.uid() in (member_a, member_b)));
create policy "Team reads its messages" on public.business_team_messages for select to authenticated
  using (public.can_access_business_team_thread(thread_id, auth.uid()));
create policy "Team sends its messages" on public.business_team_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_access_business_team_thread(thread_id, auth.uid()));

grant select, insert on public.business_team_threads to authenticated;
grant select, insert on public.business_team_messages to authenticated;
