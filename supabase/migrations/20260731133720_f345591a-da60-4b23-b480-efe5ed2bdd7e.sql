REVOKE ALL ON FUNCTION public.account_trial_active(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.active_subscription_count(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_slot_rank(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_has_access_v2(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.business_has_access(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_frozen_business_ids(uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_trial_on_first_business() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_business_slot() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.account_trial_active(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.active_subscription_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_slot_rank(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.business_has_access_v2(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;