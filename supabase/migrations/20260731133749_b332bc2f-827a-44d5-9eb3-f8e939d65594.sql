CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id uuid, _env text DEFAULT 'live')
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $function$
DECLARE
  v_template public.card_templates%ROWTYPE;
  v_business public.businesses%ROWTYPE;
  v_instance public.card_instances%ROWTYPE;
  v_last_stamp TIMESTAMPTZ;
  v_new_count INTEGER;
  v_reward JSONB;
  v_rank INTEGER;
  v_subs INTEGER;
  v_trial_start TIMESTAMPTZ;
  v_has_access BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_instance FROM public.card_instances WHERE id = _card_instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not found'; END IF;
  SELECT * INTO v_template FROM public.card_templates WHERE id = v_instance.template_id;
  SELECT * INTO v_business FROM public.businesses WHERE id = v_template.business_id;
  IF v_business.owner_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT rnk INTO v_rank FROM (
    SELECT b.id, ROW_NUMBER() OVER (ORDER BY b.created_at, b.id) AS rnk
    FROM public.businesses b WHERE b.owner_id = auth.uid()
  ) t WHERE t.id = v_business.id;

  SELECT COUNT(*)::int INTO v_subs FROM public.subscriptions
  WHERE user_id = auth.uid()
    AND environment = COALESCE(_env, 'live')
    AND (
      (status IN ('active','trialing','past_due')
        AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end IS NOT NULL AND current_period_end > now())
    );

  SELECT trial_started_at INTO v_trial_start FROM public.profiles WHERE id = auth.uid();

  v_has_access := (v_subs >= COALESCE(v_rank, 1))
    OR (COALESCE(v_rank, 1) = 1 AND COALESCE(v_trial_start, now()) + INTERVAL '14 days' > now());

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'subscription required: this business is not covered by an active Clubcarder subscription, so new stamps are paused.';
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

REVOKE ALL ON FUNCTION public.account_trial_active(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.active_subscription_count(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.business_slot_rank(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.business_has_access_v2(uuid, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.account_trial_active(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.active_subscription_count(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.business_slot_rank(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.business_has_access_v2(uuid, text) TO service_role;