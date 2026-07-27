
DROP VIEW IF EXISTS public.businesses_public;

CREATE OR REPLACE FUNCTION public.get_business_public(_id uuid)
RETURNS TABLE (id uuid, name text, slug text, logo_url text, brand_color text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.slug, b.logo_url, b.brand_color, b.created_at
  FROM public.businesses b
  WHERE b.id = _id;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_public(uuid) TO anon, authenticated;
