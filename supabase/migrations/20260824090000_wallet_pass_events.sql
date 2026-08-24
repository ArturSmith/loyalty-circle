-- Tracks what happens to a card once it lives inside Apple/Google Wallet.
--
-- Both wallet platforms are deliberately privacy-sealed: they tell us that a
-- pass was saved or removed and nothing about who did it. So this table is
-- intentionally identity-free — it hangs off the card instance, not a user.

create table if not exists public.wallet_pass_events (
  id uuid primary key default gen_random_uuid(),
  card_instance_id uuid not null references public.card_instances(id) on delete cascade,
  template_id uuid references public.card_templates(id) on delete cascade,
  platform text not null check (platform in ('google', 'apple')),
  event text not null check (event in ('created', 'saved', 'deleted')),
  object_id text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_pass_events_template_idx
  on public.wallet_pass_events (template_id, created_at desc);

create index if not exists wallet_pass_events_instance_idx
  on public.wallet_pass_events (card_instance_id);

-- One row per (instance, platform, event) so replayed callbacks stay idempotent.
-- Google re-sends save/delete callbacks on retry, and a user may save then
-- delete then save again — the upsert below refreshes created_at in that case.
create unique index if not exists wallet_pass_events_unique_idx
  on public.wallet_pass_events (card_instance_id, platform, event);

alter table public.wallet_pass_events enable row level security;

-- Only the business that owns the template may read these events. Writes come
-- exclusively from the service-role key in the wallet callback handler, which
-- bypasses RLS, so there is deliberately no insert policy for end users.
drop policy if exists "Owners read wallet pass events" on public.wallet_pass_events;
create policy "Owners read wallet pass events"
  on public.wallet_pass_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.card_templates t
      join public.businesses b on b.id = t.business_id
      where t.id = wallet_pass_events.template_id
        and b.owner_id = auth.uid()
    )
  );
