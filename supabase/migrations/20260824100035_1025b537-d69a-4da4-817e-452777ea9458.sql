-- 1. Stop exposing business locations (address, phone, precise coordinates) and
--    social links to anonymous/public readers. Members retain full access via
--    the existing "Members manage ..." policies.
DROP POLICY IF EXISTS "Locations publicly readable" ON public.business_locations;
DROP POLICY IF EXISTS "Socials publicly readable" ON public.business_socials;

REVOKE ALL ON public.business_locations FROM anon;
REVOKE ALL ON public.business_socials FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_socials TO authenticated;
GRANT ALL ON public.business_locations TO service_role;
GRANT ALL ON public.business_socials TO service_role;

-- 2. Customers may only touch presentation/wallet fields on their own card.
--    stamps_count / completed_at were already ungranted; customer_id is now
--    removed too (card claiming happens through the SECURITY DEFINER function
--    public.claim_anonymous_card).
REVOKE UPDATE ON public.card_instances FROM authenticated, anon;
GRANT UPDATE (order_index, google_object_id, claimed_at, anon_secret)
  ON public.card_instances TO authenticated;

DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
  ON public.card_instances
  FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
