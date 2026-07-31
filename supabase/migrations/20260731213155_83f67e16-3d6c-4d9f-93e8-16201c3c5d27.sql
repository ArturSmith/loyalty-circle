ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

DROP FUNCTION IF EXISTS public.get_business_public(uuid);

CREATE FUNCTION public.get_business_public(_id uuid)
RETURNS TABLE(
  id uuid, name text, slug text, logo_url text, brand_color text, created_at timestamp with time zone,
  category text, description text, welcome_message text, phone text, website text,
  address_line1 text, address_line2 text, city text, postal_code text, region text, country text,
  latitude double precision, longitude double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT b.id, b.name, b.slug, b.logo_url, b.brand_color, b.created_at,
         b.category, b.description, b.welcome_message, b.phone, b.website,
         b.address_line1, b.address_line2, b.city, b.postal_code, b.region, b.country,
         b.latitude, b.longitude
  FROM public.businesses b
  WHERE b.id = _id;
$$;