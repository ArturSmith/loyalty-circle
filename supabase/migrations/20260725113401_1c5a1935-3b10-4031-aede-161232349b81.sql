
-- 1) Convert add_stamp to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template public.card_templates%ROWTYPE;
  v_business public.businesses%ROWTYPE;
  v_instance public.card_instances%ROWTYPE;
  v_last_stamp TIMESTAMPTZ;
  v_new_count INTEGER;
  v_reward JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_instance FROM public.card_instances WHERE id = _card_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not found'; END IF;
  SELECT * INTO v_template FROM public.card_templates WHERE id = v_instance.template_id;
  SELECT * INTO v_business FROM public.businesses WHERE id = v_template.business_id;
  IF v_business.owner_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NOT public.business_has_access(v_business.owner_id, v_business.created_at) THEN
    RAISE EXCEPTION 'subscription required: your Stempel subscription is inactive, so new stamps are paused. Renew to resume stamping.';
  END IF;
  IF v_instance.stamps_count >= v_template.total_steps THEN RAISE EXCEPTION 'card is full'; END IF;
  SELECT MAX(created_at) INTO v_last_stamp FROM public.stamps WHERE card_instance_id = _card_instance_id;
  IF v_last_stamp IS NOT NULL AND v_last_stamp > now() - INTERVAL '30 seconds' THEN
    RAISE EXCEPTION 'please wait a moment before stamping again';
  END IF;
  v_new_count := v_instance.stamps_count + 1;
  INSERT INTO public.stamps (card_instance_id, issued_by, business_id, step_number)
  VALUES (_card_instance_id, auth.uid(), v_business.id, v_new_count);
  UPDATE public.card_instances
    SET stamps_count = v_new_count,
        completed_at = CASE WHEN v_new_count >= v_template.total_steps THEN now() ELSE completed_at END
    WHERE id = _card_instance_id;
  SELECT r INTO v_reward FROM jsonb_array_elements(v_template.rewards) r WHERE (r->>'step')::int = v_new_count LIMIT 1;
  RETURN jsonb_build_object('stamps_count', v_new_count, 'total_steps', v_template.total_steps, 'reward', v_reward, 'completed', v_new_count >= v_template.total_steps);
END; $function$;

-- Grant business owner the column privileges the INVOKER function needs
GRANT UPDATE (stamps_count, completed_at) ON public.card_instances TO authenticated;

-- 2) Tighten customer UPDATE policy so stamps_count/completed_at can only change during a valid renewal
DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
ON public.card_instances
FOR UPDATE
TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (
  customer_id = auth.uid()
  AND (
    -- Case A: no change to progress columns (e.g. order_index only)
    EXISTS (
      SELECT 1
      FROM public.card_instances ci
      WHERE ci.id = card_instances.id
        AND ci.stamps_count = card_instances.stamps_count
        AND ci.completed_at IS NOT DISTINCT FROM card_instances.completed_at
    )
    OR
    -- Case B: valid renewal — reset an already-completed card back to empty
    (
      stamps_count = 0
      AND completed_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.card_instances ci
        JOIN public.card_templates ct ON ct.id = ci.template_id
        WHERE ci.id = card_instances.id
          AND ci.stamps_count >= ct.total_steps
      )
    )
  )
);

-- 3) Drop the customer-callable renew_card RPC (renewal handled via UPDATE + policy above)
DROP FUNCTION IF EXISTS public.renew_card(uuid);

-- 4) Restrict get_frozen_business_ids to service_role only
REVOKE EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) TO service_role;
