DROP TRIGGER IF EXISTS guard_card_instance_insert_trg ON public.card_instances;
DROP TRIGGER IF EXISTS guard_card_instance_update_trg ON public.card_instances;

CREATE OR REPLACE FUNCTION public.guard_card_instance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_total_steps int;
BEGIN
  SELECT b.owner_id, t.total_steps
    INTO v_owner_id, v_total_steps
    FROM public.card_templates t
    JOIN public.businesses b ON b.id = t.business_id
    WHERE t.id = OLD.template_id;

  -- Nobody may re-point a card at a different program, or hand it to someone else.
  IF NEW.template_id IS DISTINCT FROM OLD.template_id THEN
    RAISE EXCEPTION 'not authorized to change template_id';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND auth.uid() IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'not authorized to change customer_id';
  END IF;

  IF NEW.stamps_count IS DISTINCT FROM OLD.stamps_count
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN

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
$function$;
