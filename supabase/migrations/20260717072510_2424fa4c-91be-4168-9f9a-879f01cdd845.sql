
CREATE OR REPLACE FUNCTION public.user_holds_card_for_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.card_instances ci
    JOIN public.card_templates ct ON ct.id = ci.template_id
    WHERE ct.business_id = _business_id
      AND ci.customer_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Cardholders can read their businesses" ON public.businesses;
CREATE POLICY "Cardholders can read their businesses"
ON public.businesses
FOR SELECT
TO authenticated
USING (public.user_holds_card_for_business(id));
