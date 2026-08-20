-- Unread message tracking.
--
-- A conversation has exactly two sides, so a column per side is enough — no
-- separate receipts table. Timestamps rather than counters: a counter has to be
-- incremented on every insert and drifts the moment anything goes wrong, whereas
-- "everything after this moment is unread" is derivable and self-correcting.
--
-- Defaulting to now() means existing conversations start fully read. Backfilling
-- them as unread would greet everyone with a badge for messages they've already
-- seen.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS customer_last_read_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS business_last_read_at timestamptz NOT NULL DEFAULT now();

-- Marks the caller's side of a conversation as read. SECURITY DEFINER so the
-- update is allowed, with the participant check done explicitly inside.
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_customer boolean;
  _is_owner boolean;
BEGIN
  SELECT c.customer_id = auth.uid(), b.owner_id = auth.uid()
    INTO _is_customer, _is_owner
    FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
   WHERE c.id = _conversation_id;

  IF _is_customer IS NULL THEN
    RETURN;
  END IF;

  IF _is_customer THEN
    UPDATE public.conversations SET customer_last_read_at = now() WHERE id = _conversation_id;
  ELSIF _is_owner THEN
    UPDATE public.conversations SET business_last_read_at = now() WHERE id = _conversation_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated, service_role;
