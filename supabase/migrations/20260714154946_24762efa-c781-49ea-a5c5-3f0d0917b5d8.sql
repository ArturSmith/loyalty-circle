-- Fix: restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS "Profiles readable by everyone" ON public.profiles;
CREATE POLICY "Profiles readable by authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- Fix: convert add_stamp to SECURITY INVOKER so it relies on caller privileges + RLS.
-- Add supporting RLS policies so business owners can insert stamps and update card_instances.

CREATE POLICY "Owners insert stamps"
  ON public.stamps FOR INSERT
  TO authenticated
  WITH CHECK (
    issued_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = stamps.business_id AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners update business instances"
  ON public.card_instances FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.card_templates t
      JOIN public.businesses b ON b.id = t.business_id
      WHERE t.id = card_instances.template_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.card_templates t
      JOIN public.businesses b ON b.id = t.business_id
      WHERE t.id = card_instances.template_id AND b.owner_id = auth.uid()
    )
  );

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
