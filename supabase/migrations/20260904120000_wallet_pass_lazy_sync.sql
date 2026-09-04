-- Lazy self-heal for Google Wallet passes.
--
-- Stamping happens inside `stamp_business_card`, and the pass update is fired
-- from the scanning device as a best-effort call. A network blip there leaves
-- the customer's pass showing a stale count forever, and a business being
-- frozen changes nothing on the pass at all.
--
-- Rather than call out to Google from inside a transaction (which would need
-- pg_net and puts a third-party API in the stamping path), record what was last
-- pushed. Anything that disagrees with the row is stale and gets repaired the
-- next time the customer opens their wallet.
begin;

-- The stamp count as Google last accepted it. NULL means "never pushed".
-- Comparing against stamps_count is exact: no clock skew, no missed updates.
alter table public.card_instances
  add column if not exists wallet_synced_stamps integer;

-- Separately, a timestamp so state that is *not* derived from stamps_count
-- (notably a business freeze/unfreeze) still converges, via a periodic refresh.
alter table public.card_instances
  add column if not exists wallet_synced_at timestamptz;

-- Only rows that actually have a pass are ever candidates, and that is a small
-- minority of the table, so the index stays cheap.
create index if not exists card_instances_wallet_sync_idx
  on public.card_instances (customer_id, wallet_synced_at)
  where google_object_id is not null;

-- These columns are written exclusively by the server using the service role.
-- Customers must not be able to mark their own pass as freshly synced, which
-- would let them pin a stale stamp count in place.
revoke update (wallet_synced_stamps, wallet_synced_at)
  on public.card_instances from authenticated, anon;

commit;
