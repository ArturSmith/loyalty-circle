REVOKE EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) TO service_role;