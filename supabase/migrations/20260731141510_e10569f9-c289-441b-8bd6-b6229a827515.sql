-- 1) Hide date_of_birth from the Data API for signed-in users -----------------
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, created_at, updated_at, trial_started_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2) Card completion integrity ------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_card_instance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_total_steps int;
BEGIN
  IF NEW.stamps_count IS DISTINCT FROM OLD.stamps_count
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN

    SELECT b.owner_id, t.total_steps
      INTO v_owner_id, v_total_steps
      FROM public.card_templates t
      JOIN public.businesses b ON b.id = t.business_id
      WHERE t.id = NEW.template_id;

    -- Business owner stamping (add_stamp path)
    IF auth.uid() = v_owner_id THEN
      RETURN NEW;
    END IF;

    -- Trusted renew path only: public.renew_card() sets this flag
    IF current_setting('app.renew_ok', true) = '1'
       AND auth.uid() = NEW.customer_id
       AND OLD.stamps_count >= v_total_steps
       AND NEW.stamps_count = 0
       AND NEW.completed_at IS NULL THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'not authorized to modify stamps_count or completed_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_card_instance_update_trg ON public.card_instances;
CREATE TRIGGER guard_card_instance_update_trg
  BEFORE UPDATE ON public.card_instances
  FOR EACH ROW EXECUTE FUNCTION public.guard_card_instance_update();

DROP TRIGGER IF EXISTS guard_card_instance_insert_trg ON public.card_instances;
CREATE TRIGGER guard_card_instance_insert_trg
  BEFORE INSERT ON public.card_instances
  FOR EACH ROW EXECUTE FUNCTION public.guard_card_instance_insert();

-- Customers may update their own row, but never the stamp columns (trigger enforced)
DROP POLICY IF EXISTS "Customer updates own instance" ON public.card_instances;
CREATE POLICY "Customer updates own instance"
  ON public.card_instances FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Controlled renew action
CREATE OR REPLACE FUNCTION public.renew_card(_card_instance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_instance public.card_instances%ROWTYPE;
  v_total int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_instance FROM public.card_instances WHERE id = _card_instance_id;
  IF NOT FOUND OR v_instance.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'card not found';
  END IF;

  SELECT total_steps INTO v_total FROM public.card_templates WHERE id = v_instance.template_id;
  IF v_instance.stamps_count < v_total THEN
    RAISE EXCEPTION 'card is not complete yet';
  END IF;

  PERFORM set_config('app.renew_ok', '1', true);
  UPDATE public.card_instances
    SET stamps_count = 0, completed_at = NULL
    WHERE id = _card_instance_id;
  PERFORM set_config('app.renew_ok', '0', true);
END;
$$;

REVOKE ALL ON FUNCTION public.renew_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_card(uuid) TO authenticated;

-- 3) Lock down internal SECURITY DEFINER helpers ------------------------------
REVOKE ALL ON FUNCTION public.account_trial_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.active_subscription_count(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_has_access(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_has_access_v2(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_slot_rank(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_frozen_business_ids(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_frozen_business_ids(uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_business_slot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_card_instance_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_card_instance_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_trial_on_first_business() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.account_trial_active(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.active_subscription_count(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.business_has_access_v2(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.business_slot_rank(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[], text) TO service_role;

-- Public business lookup stays reachable (used by business QR pages)
GRANT EXECUTE ON FUNCTION public.get_business_public(uuid) TO anon, authenticated, service_role;