
CREATE TABLE public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_instance_id uuid NOT NULL REFERENCES public.card_instances(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.card_templates(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'unused',
  created_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  redeemed_by uuid REFERENCES auth.users(id),
  CONSTRAINT vouchers_status_check CHECK (status IN ('unused','used'))
);

CREATE INDEX vouchers_customer_idx ON public.vouchers(customer_id);
CREATE INDEX vouchers_business_idx ON public.vouchers(business_id);
CREATE INDEX vouchers_template_idx ON public.vouchers(template_id);
CREATE INDEX vouchers_instance_idx ON public.vouchers(card_instance_id);

GRANT SELECT, INSERT, UPDATE ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own vouchers" ON public.vouchers
FOR SELECT TO authenticated USING (customer_id = auth.uid());

CREATE POLICY "Owners read business vouchers" ON public.vouchers
FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.businesses b WHERE b.id = vouchers.business_id AND b.owner_id = auth.uid()
));

CREATE POLICY "Owners issue vouchers" ON public.vouchers
FOR INSERT TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM public.businesses b WHERE b.id = vouchers.business_id AND b.owner_id = auth.uid()
));

CREATE POLICY "Owners redeem vouchers" ON public.vouchers
FOR UPDATE TO authenticated USING (EXISTS (
  SELECT 1 FROM public.businesses b WHERE b.id = vouchers.business_id AND b.owner_id = auth.uid()
)) WITH CHECK (EXISTS (
  SELECT 1 FROM public.businesses b WHERE b.id = vouchers.business_id AND b.owner_id = auth.uid()
));

-- Stamping now skips reward steps and issues a voucher instead.
CREATE OR REPLACE FUNCTION public.add_stamp(_card_instance_id uuid, _env text DEFAULT 'live'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_template public.card_templates%ROWTYPE;
  v_business public.businesses%ROWTYPE;
  v_instance public.card_instances%ROWTYPE;
  v_last_stamp TIMESTAMPTZ;
  v_new_count INTEGER;
  v_reward JSONB;
  v_reward_label TEXT;
  v_vouchers JSONB := '[]'::jsonb;
  v_voucher_id UUID;
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

  -- Any reward sitting on the following steps is unlocked right away: the reward
  -- slot is filled by the voucher, not by a stamp, so the next scan lands after it.
  LOOP
    EXIT WHEN v_new_count >= v_template.total_steps;
    SELECT r INTO v_reward
      FROM jsonb_array_elements(COALESCE(v_template.rewards, '[]'::jsonb)) r
      WHERE (r->>'step')::int = v_new_count + 1
      LIMIT 1;
    EXIT WHEN v_reward IS NULL;
    v_new_count := v_new_count + 1;
    v_reward_label := COALESCE(NULLIF(v_reward->>'label', ''), 'Reward');
    INSERT INTO public.vouchers (card_instance_id, template_id, business_id, customer_id, step_number, label)
    VALUES (_card_instance_id, v_template.id, v_business.id, v_instance.customer_id, v_new_count, v_reward_label)
    RETURNING id INTO v_voucher_id;
    v_vouchers := v_vouchers || jsonb_build_object('id', v_voucher_id, 'step', v_new_count, 'label', v_reward_label);
    v_reward := NULL;
  END LOOP;

  UPDATE public.card_instances
    SET stamps_count = v_new_count,
        completed_at = CASE WHEN v_new_count >= v_template.total_steps THEN now() ELSE completed_at END
    WHERE id = _card_instance_id;

  RETURN jsonb_build_object(
    'stamps_count', v_new_count,
    'total_steps', v_template.total_steps,
    'reward', CASE WHEN jsonb_array_length(v_vouchers) > 0 THEN v_vouchers -> (jsonb_array_length(v_vouchers) - 1) ELSE NULL END,
    'vouchers', v_vouchers,
    'completed', v_new_count >= v_template.total_steps
  );
END; $function$;

CREATE OR REPLACE FUNCTION public.redeem_voucher(_voucher_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_voucher public.vouchers%ROWTYPE;
  v_business public.businesses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_voucher FROM public.vouchers WHERE id = _voucher_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'voucher not found'; END IF;
  SELECT * INTO v_business FROM public.businesses WHERE id = v_voucher.business_id;
  IF v_business.owner_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF v_voucher.status = 'used' THEN RAISE EXCEPTION 'voucher already used'; END IF;

  UPDATE public.vouchers
     SET status = 'used', redeemed_at = now(), redeemed_by = auth.uid()
   WHERE id = _voucher_id;

  RETURN jsonb_build_object('id', v_voucher.id, 'label', v_voucher.label, 'business_name', v_business.name);
END; $function$;

REVOKE ALL ON FUNCTION public.redeem_voucher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid) TO authenticated;
