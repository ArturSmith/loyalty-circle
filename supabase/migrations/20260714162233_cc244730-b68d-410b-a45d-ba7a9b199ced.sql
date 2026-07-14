DROP POLICY IF EXISTS "Businesses publicly readable" ON public.businesses;
CREATE POLICY "Businesses readable by authenticated"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.businesses FROM anon;

DROP POLICY IF EXISTS "Templates publicly readable" ON public.card_templates;
CREATE POLICY "Templates readable by authenticated"
  ON public.card_templates FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.card_templates FROM anon;