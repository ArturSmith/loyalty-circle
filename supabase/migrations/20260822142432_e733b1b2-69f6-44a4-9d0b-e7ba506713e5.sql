CREATE TABLE public.card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  template_id uuid,
  card_instance_id uuid,
  customer_id uuid,
  event_type text NOT NULL,
  step_number integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.card_events TO authenticated;
GRANT ALL ON public.card_events TO service_role;

ALTER TABLE public.card_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read business events" ON public.card_events
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = card_events.business_id AND b.owner_id = auth.uid()));

CREATE INDEX idx_card_events_template ON public.card_events(template_id, created_at DESC);
CREATE INDEX idx_card_events_business ON public.card_events(business_id, created_at DESC);
CREATE INDEX idx_card_events_instance ON public.card_events(card_instance_id);

-- instance lifecycle ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_card_instance_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business uuid;
  v_row public.card_instances;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT t.business_id INTO v_business FROM public.card_templates t WHERE t.id = v_row.template_id;
  IF v_business IS NULL THEN RETURN v_row; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number)
    VALUES (v_business, v_row.template_id, v_row.id, v_row.customer_id, 'card_added', 0);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number)
    VALUES (v_business, v_row.template_id, v_row.id, v_row.customer_id, 'card_removed', OLD.stamps_count);
  ELSE
    IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
      INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number)
      VALUES (v_business, NEW.template_id, NEW.id, NEW.customer_id, 'card_completed', NEW.stamps_count);
    ELSIF OLD.completed_at IS NOT NULL AND NEW.completed_at IS NULL THEN
      INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number)
      VALUES (v_business, NEW.template_id, NEW.id, NEW.customer_id, 'card_renewed', 0);
    END IF;
  END IF;
  RETURN v_row;
END;
$$;

CREATE TRIGGER trg_card_instances_events
AFTER INSERT OR UPDATE OR DELETE ON public.card_instances
FOR EACH ROW EXECUTE FUNCTION public.log_card_instance_event();

-- stamps ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_stamp_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template uuid;
  v_customer uuid;
BEGIN
  SELECT ci.template_id, ci.customer_id INTO v_template, v_customer
  FROM public.card_instances ci WHERE ci.id = NEW.card_instance_id;

  INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number)
  VALUES (NEW.business_id, v_template, NEW.card_instance_id, v_customer, 'stamp', NEW.step_number);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamps_events
AFTER INSERT ON public.stamps
FOR EACH ROW EXECUTE FUNCTION public.log_stamp_event();

-- vouchers ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_voucher_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, metadata)
    VALUES (NEW.business_id, NEW.template_id, NEW.card_instance_id, NEW.customer_id, 'reward_issued', NEW.step_number,
            jsonb_build_object('voucher_id', NEW.id, 'label', NEW.label));
  ELSIF NEW.status = 'used' AND OLD.status <> 'used' THEN
    INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, metadata)
    VALUES (NEW.business_id, NEW.template_id, NEW.card_instance_id, NEW.customer_id, 'reward_redeemed', NEW.step_number,
            jsonb_build_object('voucher_id', NEW.id, 'label', NEW.label));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vouchers_events
AFTER INSERT OR UPDATE ON public.vouchers
FOR EACH ROW EXECUTE FUNCTION public.log_voucher_event();

-- backfill ----------------------------------------------------------------
INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, created_at)
SELECT t.business_id, ci.template_id, ci.id, ci.customer_id, 'card_added', 0, ci.created_at
FROM public.card_instances ci JOIN public.card_templates t ON t.id = ci.template_id;

INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, created_at)
SELECT s.business_id, ci.template_id, s.card_instance_id, ci.customer_id, 'stamp', s.step_number, s.created_at
FROM public.stamps s JOIN public.card_instances ci ON ci.id = s.card_instance_id;

INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, created_at)
SELECT t.business_id, ci.template_id, ci.id, ci.customer_id, 'card_completed', ci.stamps_count, ci.completed_at
FROM public.card_instances ci JOIN public.card_templates t ON t.id = ci.template_id
WHERE ci.completed_at IS NOT NULL;

INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, metadata, created_at)
SELECT v.business_id, v.template_id, v.card_instance_id, v.customer_id, 'reward_issued', v.step_number,
       jsonb_build_object('voucher_id', v.id, 'label', v.label), v.created_at
FROM public.vouchers v;

INSERT INTO public.card_events (business_id, template_id, card_instance_id, customer_id, event_type, step_number, metadata, created_at)
SELECT v.business_id, v.template_id, v.card_instance_id, v.customer_id, 'reward_redeemed', v.step_number,
       jsonb_build_object('voucher_id', v.id, 'label', v.label), v.redeemed_at
FROM public.vouchers v WHERE v.status = 'used' AND v.redeemed_at IS NOT NULL;