
-- 1) Block customers from directly writing stamps_count / completed_at
--    Column-level UPDATE grants: allow customers to only touch order_index.
REVOKE UPDATE ON public.card_instances FROM authenticated;
REVOKE UPDATE ON public.card_instances FROM anon;
GRANT UPDATE (order_index) ON public.card_instances TO authenticated;
-- Owners mutate through add_stamp() (SECURITY DEFINER) and renew_card()
-- runs SECURITY DEFINER too, so no direct UPDATE grant is required for
-- normal app flows. service_role keeps full access.
GRANT ALL ON public.card_instances TO service_role;

-- 2) Lock down SECURITY DEFINER function EXECUTE grants.
-- Trigger-only functions: no direct callers needed.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_card_instance_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_card_instance_insert() FROM PUBLIC, anon, authenticated;

-- Internal helpers used by RLS / server code only.
REVOKE EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) FROM PUBLIC, anon;
-- authenticated needs get_frozen_business_ids for the wallet freeze UI
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;

-- RPCs callable by signed-in users only.
REVOKE EXECUTE ON FUNCTION public.add_stamp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_stamp(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.renew_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renew_card(uuid) TO authenticated;
