ALTER TABLE public.card_instances ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.card_instances ADD COLUMN IF NOT EXISTS anon_secret uuid;
ALTER TABLE public.card_instances ADD COLUMN IF NOT EXISTS google_object_id text;
ALTER TABLE public.card_instances ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS card_instances_google_object_id_key ON public.card_instances (google_object_id) WHERE google_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS card_instances_anon_secret_idx ON public.card_instances (anon_secret) WHERE anon_secret IS NOT NULL;

ALTER TABLE public.card_templates ADD COLUMN IF NOT EXISTS google_class_id text;

CREATE OR REPLACE FUNCTION public.claim_anonymous_card(_instance_id uuid, _secret uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_instance public.card_instances%ROWTYPE;
  v_existing public.card_instances%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_instance FROM public.card_instances WHERE id = _instance_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'card not found'; END IF;

  IF v_instance.customer_id = auth.uid() THEN
    RETURN v_instance.id;
  END IF;

  IF v_instance.customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'this card already belongs to another account';
  END IF;

  IF v_instance.anon_secret IS NULL OR v_instance.anon_secret <> _secret THEN
    RAISE EXCEPTION 'invalid claim link';
  END IF;

  SELECT * INTO v_existing FROM public.card_instances
    WHERE template_id = v_instance.template_id AND customer_id = auth.uid() LIMIT 1;
  IF FOUND THEN
    RETURN v_existing.id;
  END IF;

  UPDATE public.card_instances
    SET customer_id = auth.uid(), claimed_at = now(), anon_secret = NULL
    WHERE id = _instance_id;

  RETURN _instance_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_anonymous_card(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_card(uuid, uuid) TO authenticated, service_role;