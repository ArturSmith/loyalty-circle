CREATE OR REPLACE FUNCTION public.get_frozen_business_ids(_ids uuid[])
RETURNS TABLE(business_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id
  FROM public.businesses b
  WHERE b.id = ANY(_ids)
    AND NOT public.business_has_access(b.owner_id, b.created_at);
$$;

REVOKE EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) TO authenticated, service_role;