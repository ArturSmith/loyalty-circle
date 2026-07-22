
-- 1) Guard INSERT on card_instances: only business owner may seed non-zero stamps/completed_at.
CREATE OR REPLACE FUNCTION public.guard_card_instance_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT b.owner_id INTO v_owner_id
    FROM public.card_templates t
    JOIN public.businesses b ON b.id = t.business_id
    WHERE t.id = NEW.template_id;

  IF auth.uid() IS DISTINCT FROM v_owner_id THEN
    -- Customers (or anyone not the owner) must start clean.
    NEW.stamps_count := 0;
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_card_instance_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_card_instance_insert ON public.card_instances;
CREATE TRIGGER guard_card_instance_insert
BEFORE INSERT ON public.card_instances
FOR EACH ROW EXECUTE FUNCTION public.guard_card_instance_insert();

-- 2) Make add_stamp SECURITY DEFINER so we can lock down helper access.
CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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

-- 3) Revoke direct signed-in access to helper SECURITY DEFINER functions no longer needed by clients.
REVOKE EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
