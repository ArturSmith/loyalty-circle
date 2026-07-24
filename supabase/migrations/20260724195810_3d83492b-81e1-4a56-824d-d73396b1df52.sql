
-- Fix 1: card_instance_selfwrite — prevent customers from writing to stamps_count/completed_at columns directly.
-- Revoke column-level UPDATE from authenticated; only owner (add_stamp SECURITY DEFINER) and new renew_card RPC may touch these.
REVOKE UPDATE (stamps_count, completed_at) ON public.card_instances FROM authenticated;
GRANT UPDATE (stamps_count, completed_at) ON public.card_instances TO service_role;

-- Renewal RPC so customers can reset a completed card without direct column writes.
CREATE OR REPLACE FUNCTION public.renew_card(_card_instance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance public.card_instances%ROWTYPE;
  v_template public.card_templates%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_instance FROM public.card_instances WHERE id = _card_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not found'; END IF;
  IF v_instance.customer_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO v_template FROM public.card_templates WHERE id = v_instance.template_id;
  IF v_instance.stamps_count < v_template.total_steps THEN
    RAISE EXCEPTION 'card is not completed yet';
  END IF;
  UPDATE public.card_instances
    SET stamps_count = 0, completed_at = NULL
    WHERE id = _card_instance_id;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_card(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.renew_card(uuid) TO authenticated;

-- Fix 2: SUPA_authenticated_security_definer_function_executable
-- user_holds_card_for_business only reads rows the caller already sees via RLS; switch to SECURITY INVOKER.
CREATE OR REPLACE FUNCTION public.user_holds_card_for_business(_business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.card_instances ci
    JOIN public.card_templates ct ON ct.id = ci.template_id
    WHERE ct.business_id = _business_id
      AND ci.customer_id = auth.uid()
  );
$$;
