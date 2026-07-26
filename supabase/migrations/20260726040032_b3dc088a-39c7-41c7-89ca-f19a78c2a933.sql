GRANT SELECT ON public.card_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_templates TO authenticated;
GRANT ALL ON public.card_templates TO service_role;

DROP POLICY IF EXISTS "Active templates readable by anon" ON public.card_templates;
DROP POLICY IF EXISTS "Active templates readable by authenticated" ON public.card_templates;
DROP POLICY IF EXISTS "Active templates readable by everyone" ON public.card_templates;

CREATE POLICY "Active templates readable by everyone"
  ON public.card_templates
  FOR SELECT
  TO anon, authenticated
  USING (active = true);