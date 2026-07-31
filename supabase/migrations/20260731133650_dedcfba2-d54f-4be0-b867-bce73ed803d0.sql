-- 1. Account-level trial start
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

UPDATE public.profiles p
SET trial_started_at = b.first_created
FROM (
  SELECT owner_id, MIN(created_at) AS first_created
  FROM public.businesses GROUP BY owner_id
) b
WHERE b.owner_id = p.id AND p.trial_started_at IS NULL;

CREATE OR REPLACE FUNCTION public.start_trial_on_first_business()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
    SET trial_started_at = COALESCE(trial_started_at, now())
    WHERE id = NEW.owner_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_start_trial_on_first_business ON public.businesses;
CREATE TRIGGER trg_start_trial_on_first_business
AFTER INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.start_trial_on_first_business();

-- 2. Helpers
CREATE OR REPLACE FUNCTION public.account_trial_active(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT trial_started_at FROM public.profiles WHERE id = _user_id), now())
         + INTERVAL '14 days' > now();
$$;

CREATE OR REPLACE FUNCTION public.active_subscription_count(_user_id uuid, _env text DEFAULT 'live')
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.subscriptions
  WHERE user_id = _user_id
    AND environment = _env
    AND (
      (status IN ('active','trialing','past_due')
        AND (current_period_end IS NULL OR current_period_end > now()))
      OR (status = 'canceled' AND current_period_end IS NOT NULL AND current_period_end > now())
    );
$$;

-- 1-based position of the business among the owner's businesses (oldest first)
CREATE OR REPLACE FUNCTION public.business_slot_rank(_business_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rnk FROM (
    SELECT b.id, ROW_NUMBER() OVER (PARTITION BY b.owner_id ORDER BY b.created_at, b.id) AS rnk
    FROM public.businesses b
    WHERE b.owner_id = (SELECT owner_id FROM public.businesses WHERE id = _business_id)
  ) t WHERE t.id = _business_id;
$$;

-- 3. New env-aware, per-business access check
CREATE OR REPLACE FUNCTION public.business_has_access_v2(_business_id uuid, _env text DEFAULT 'live')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_rank int;
  v_subs int;
BEGIN
  SELECT owner_id INTO v_owner FROM public.businesses WHERE id = _business_id;
  IF v_owner IS NULL THEN RETURN false; END IF;
  v_rank := public.business_slot_rank(_business_id);
  v_subs := public.active_subscription_count(v_owner, _env);
  IF v_subs >= v_rank THEN RETURN true; END IF;
  IF v_rank = 1 AND public.account_trial_active(v_owner) THEN RETURN true; END IF;
  RETURN false;
END; $$;

-- Keep the old signature working (legacy callers), now env-strict on live.
CREATE OR REPLACE FUNCTION public.business_has_access(_owner_id uuid, _business_created_at timestamp with time zone)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.account_trial_active(_owner_id)
      OR public.active_subscription_count(_owner_id, 'live') > 0;
$$;

-- 4. Frozen businesses, env aware
CREATE OR REPLACE FUNCTION public.get_frozen_business_ids(_ids uuid[], _env text DEFAULT 'live')
RETURNS TABLE(business_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id FROM public.businesses b
  WHERE b.id = ANY(_ids) AND NOT public.business_has_access_v2(b.id, _env);
$$;

-- 5. Stamping, env aware
CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id uuid, _env text DEFAULT 'live')
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $function$
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
  IF NOT public.business_has_access_v2(v_business.id, COALESCE(_env, 'live')) THEN
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

-- 6. Block creating a business with no free slot
CREATE OR REPLACE FUNCTION public.guard_business_slot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing int;
  v_subs int;
BEGIN
  SELECT COUNT(*)::int INTO v_existing FROM public.businesses WHERE owner_id = NEW.owner_id;
  IF v_existing = 0 THEN RETURN NEW; END IF;
  -- Any environment counts here; stamping enforces the strict environment match.
  SELECT GREATEST(
    public.active_subscription_count(NEW.owner_id, 'live'),
    public.active_subscription_count(NEW.owner_id, 'sandbox')
  ) INTO v_subs;
  IF v_subs >= v_existing + 1 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Each business needs its own subscription. Subscribe again to add another business.';
END; $$;

DROP TRIGGER IF EXISTS trg_guard_business_slot ON public.businesses;
CREATE TRIGGER trg_guard_business_slot
BEFORE INSERT ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.guard_business_slot();