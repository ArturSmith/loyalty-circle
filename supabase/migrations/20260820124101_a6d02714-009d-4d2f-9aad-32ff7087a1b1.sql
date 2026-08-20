REVOKE ALL ON FUNCTION public.touch_conversation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_conversation() TO service_role;