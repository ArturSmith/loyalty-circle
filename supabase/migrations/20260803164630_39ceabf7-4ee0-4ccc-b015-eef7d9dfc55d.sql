
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS comped boolean NOT NULL DEFAULT false;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS comped_note text;

DROP POLICY IF EXISTS "Admins read all businesses" ON public.businesses;
CREATE POLICY "Admins read all businesses" ON public.businesses
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Owners must not be able to grant themselves free access.
CREATE OR REPLACE FUNCTION public.guard_comped_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.comped IS DISTINCT FROM OLD.comped OR NEW.comped_note IS DISTINCT FROM OLD.comped_note)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'only staff admins can change free access';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_comped_change ON public.businesses;
CREATE TRIGGER trg_guard_comped_change BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_comped_change();

CREATE OR REPLACE FUNCTION public.guard_comped_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.comped AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.comped := false;
    NEW.comped_note := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_comped_insert ON public.businesses;
CREATE TRIGGER trg_guard_comped_insert BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.guard_comped_insert();

-- Comped businesses don't consume subscription seats.
CREATE OR REPLACE FUNCTION public.business_slot_rank(_business_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rnk FROM (
    SELECT b.id, ROW_NUMBER() OVER (PARTITION BY b.owner_id ORDER BY b.created_at, b.id) AS rnk
    FROM public.businesses b
    WHERE b.owner_id = (SELECT owner_id FROM public.businesses WHERE id = _business_id)
      AND b.comped = false
  ) t WHERE t.id = _business_id;
$$;

CREATE OR REPLACE FUNCTION public.business_has_access_v2(_business_id uuid, _env text DEFAULT 'live')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_comped boolean;
  v_rank int;
  v_subs int;
BEGIN
  SELECT owner_id, comped INTO v_owner, v_comped FROM public.businesses WHERE id = _business_id;
  IF v_owner IS NULL THEN RETURN false; END IF;
  IF v_comped THEN RETURN true; END IF;
  v_rank := public.business_slot_rank(_business_id);
  v_subs := public.active_subscription_count(v_owner, _env);
  IF v_subs >= v_rank THEN RETURN true; END IF;
  IF v_rank = 1 AND public.account_trial_active(v_owner) THEN RETURN true; END IF;
  RETURN false;
END; $$;

CREATE OR REPLACE FUNCTION public.guard_business_slot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing int;
  v_subs int;
BEGIN
  IF NEW.comped THEN RETURN NEW; END IF;
  SELECT COUNT(*)::int INTO v_existing FROM public.businesses
    WHERE owner_id = NEW.owner_id AND comped = false;
  IF v_existing = 0 THEN RETURN NEW; END IF;
  SELECT GREATEST(
    public.active_subscription_count(NEW.owner_id, 'live'),
    public.active_subscription_count(NEW.owner_id, 'sandbox')
  ) INTO v_subs;
  IF v_subs >= v_existing + 1 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Each business needs its own subscription. Subscribe again to add another business.';
END; $$;

CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id uuid, _env text DEFAULT 'live')
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
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
END; $$;
