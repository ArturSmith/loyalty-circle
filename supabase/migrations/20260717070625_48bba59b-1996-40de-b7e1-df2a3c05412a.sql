
-- Column-scoped SELECT for authenticated: no owner_id exposure
GRANT SELECT (id, name, logo_url, brand_color, slug, created_at, updated_at) ON public.businesses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;

-- Allow customers holding a card to read the (limited) business row for that card
DROP POLICY IF EXISTS "Card holders read business basics" ON public.businesses;
CREATE POLICY "Card holders read business basics" ON public.businesses
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.card_instances ci
  JOIN public.card_templates ct ON ct.id = ci.template_id
  WHERE ct.business_id = businesses.id AND ci.customer_id = auth.uid()
));
