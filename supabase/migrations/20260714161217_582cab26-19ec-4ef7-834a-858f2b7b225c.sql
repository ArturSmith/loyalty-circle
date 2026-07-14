
-- Tighten profiles visibility
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Business owners are visible to customers who hold one of their cards
CREATE POLICY "Business owners visible to their customers"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    JOIN public.card_templates t ON t.business_id = b.id
    JOIN public.card_instances ci ON ci.template_id = t.id
    WHERE b.owner_id = profiles.id AND ci.customer_id = auth.uid()
  ));

-- Customers are visible to business owners whose cards they hold
CREATE POLICY "Customers visible to their business owners"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.card_instances ci
    JOIN public.card_templates t ON t.id = ci.template_id
    JOIN public.businesses b ON b.id = t.business_id
    WHERE ci.customer_id = profiles.id AND b.owner_id = auth.uid()
  ));

-- Symmetric ownership scope on card_instances: allow business owners to delete
CREATE POLICY "Owners delete business instances"
  ON public.card_instances FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.card_templates t
    JOIN public.businesses b ON b.id = t.business_id
    WHERE t.id = card_instances.template_id AND b.owner_id = auth.uid()
  ));

-- Prevent customers from reassigning their instance to another user via UPDATE
DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
  ON public.card_instances FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
