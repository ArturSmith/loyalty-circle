-- Fix scan stamping permission error:
-- add_stamp() calls business_has_access(), so authenticated users need EXECUTE.

REVOKE EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_has_access(uuid, timestamptz) TO authenticated, service_role;
