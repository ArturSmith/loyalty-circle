
-- Remove broad SELECT policies on businesses
DROP POLICY IF EXISTS "Businesses readable by anon" ON public.businesses;
DROP POLICY IF EXISTS "Businesses readable by authenticated" ON public.businesses;

-- Revoke any column-level anon grants left over
REVOKE ALL ON public.businesses FROM anon;

-- Owner-only read policy
CREATE POLICY "Owners read own business"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);
