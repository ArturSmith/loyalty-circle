
-- Scope owner-only management policies to authenticated so anon RLS evaluation
-- does not need to read owner_id (which anon has no column privilege on).

DROP POLICY IF EXISTS "Owners manage templates" ON public.card_templates;
CREATE POLICY "Owners manage templates"
  ON public.card_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = card_templates.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = card_templates.business_id AND b.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Owners delete own business" ON public.businesses;
CREATE POLICY "Owners delete own business"
  ON public.businesses FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners insert own business" ON public.businesses;
CREATE POLICY "Owners insert own business"
  ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners update own business" ON public.businesses;
CREATE POLICY "Owners update own business"
  ON public.businesses FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);
