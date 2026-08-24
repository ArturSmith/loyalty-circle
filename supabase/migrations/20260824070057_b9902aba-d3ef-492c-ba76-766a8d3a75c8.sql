-- 1. card_events: only server-side (definer triggers / service role) may write
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.card_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, SELECT ON public.card_events FROM anon;
GRANT SELECT ON public.card_events TO authenticated;
GRANT ALL ON public.card_events TO service_role;

ALTER TABLE public.card_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client inserts into card_events" ON public.card_events;
CREATE POLICY "No client inserts into card_events"
  ON public.card_events AS RESTRICTIVE FOR INSERT
  TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates of card_events" ON public.card_events;
CREATE POLICY "No client updates of card_events"
  ON public.card_events AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes of card_events" ON public.card_events;
CREATE POLICY "No client deletes of card_events"
  ON public.card_events AS RESTRICTIVE FOR DELETE
  TO anon, authenticated USING (false);

-- 2. card_instances: customers may only touch non-sensitive columns
REVOKE UPDATE ON public.card_instances FROM authenticated, anon;
GRANT UPDATE (order_index, google_object_id, claimed_at, customer_id, anon_secret)
  ON public.card_instances TO authenticated;
GRANT ALL ON public.card_instances TO service_role;

DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
  ON public.card_instances FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
