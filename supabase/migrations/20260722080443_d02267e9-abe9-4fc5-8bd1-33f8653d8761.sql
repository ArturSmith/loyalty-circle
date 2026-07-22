
CREATE OR REPLACE FUNCTION public.guard_card_instance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Business owner: unrestricted (add_stamp RPC path)
    IF auth.uid() = v_owner_id THEN
      RETURN NEW;
    END IF;

    -- Customer: only allowed transition is renewing a completed card
    IF auth.uid() = NEW.customer_id
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

DROP TRIGGER IF EXISTS guard_card_instance_update ON public.card_instances;
CREATE TRIGGER guard_card_instance_update
BEFORE UPDATE ON public.card_instances
FOR EACH ROW EXECUTE FUNCTION public.guard_card_instance_update();
