-- 1) card_instances: customers may only touch non-sensitive columns
REVOKE UPDATE ON public.card_instances FROM authenticated;
REVOKE UPDATE ON public.card_instances FROM anon;
GRANT UPDATE (order_index, google_object_id, claimed_at, anon_secret) ON public.card_instances TO authenticated;

DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
ON public.card_instances FOR UPDATE TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid() AND stamps_count = 0 OR customer_id = auth.uid());

-- 2) profiles: remove full-row cross-party access, expose a safe view instead
DROP POLICY IF EXISTS "Business owners visible to their customers" ON public.profiles;
DROP POLICY IF EXISTS "Customers visible to their business staff" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT p.id, p.display_name, p.avatar_url
FROM public.profiles p
WHERE
  p.id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.card_templates t ON t.business_id = b.id
    JOIN public.card_instances ci ON ci.template_id = t.id
    WHERE b.owner_id = p.id AND ci.customer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.card_instances ci
    JOIN public.card_templates t ON t.id = ci.template_id
    WHERE ci.customer_id = p.id
      AND public.has_business_permission(t.business_id, auth.uid(), 'customers.view')
  );

REVOKE ALL ON public.profiles_public FROM anon;
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT ALL ON public.profiles_public TO service_role;