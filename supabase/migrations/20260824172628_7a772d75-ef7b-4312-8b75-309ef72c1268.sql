DROP VIEW IF EXISTS public.profiles_public;

-- Cross-party lookups are allowed again, but only for non-sensitive columns.
CREATE POLICY "Business owners visible to their customers"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.businesses b
  JOIN public.card_templates t ON t.business_id = b.id
  JOIN public.card_instances ci ON ci.template_id = t.id
  WHERE b.owner_id = profiles.id AND ci.customer_id = auth.uid()
));

CREATE POLICY "Customers visible to their business staff"
ON public.profiles FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.card_instances ci
  JOIN public.card_templates t ON t.id = ci.template_id
  WHERE ci.customer_id = profiles.id
    AND public.has_business_permission(t.business_id, auth.uid(), 'customers.view')
));

REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, display_name, avatar_url, created_at) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
ON public.card_instances FOR UPDATE TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());