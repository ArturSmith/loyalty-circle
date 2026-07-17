
REVOKE EXECUTE ON FUNCTION public.user_holds_card_for_business(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_holds_card_for_business(uuid) TO authenticated;
