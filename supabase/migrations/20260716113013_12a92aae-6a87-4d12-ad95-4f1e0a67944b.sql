GRANT SELECT ON public.businesses TO anon;
GRANT SELECT ON public.card_templates TO anon;

CREATE POLICY "Businesses readable by anon"
  ON public.businesses FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Active templates readable by anon"
  ON public.card_templates FOR SELECT
  TO anon
  USING (active = true);