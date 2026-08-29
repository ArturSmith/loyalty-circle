REVOKE ALL ON FUNCTION public.get_frozen_business_ids(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_frozen_business_ids(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[], text) TO authenticated, service_role;