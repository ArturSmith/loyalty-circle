CREATE OR REPLACE FUNCTION public.discover_cards(
  _lat double precision DEFAULT NULL,
  _lng double precision DEFAULT NULL,
  _q text DEFAULT NULL,
  _limit integer DEFAULT 200
)
RETURNS TABLE(
  template_id uuid,
  business_id uuid,
  business_name text,
  business_logo_url text,
  category text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  title text,
  subtitle text,
  corner_title text,
  description text,
  total_steps integer,
  grid_cols smallint,
  shape text,
  bg_color text,
  accent_color text,
  text_color text,
  stamp_icon text,
  logo_url text,
  rewards jsonb,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, b.id, b.name, b.logo_url, b.category, b.city, b.country,
         b.latitude, b.longitude,
         CASE
           WHEN _lat IS NULL OR _lng IS NULL OR b.latitude IS NULL OR b.longitude IS NULL THEN NULL
           ELSE 6371 * 2 * asin(sqrt(
                power(sin(radians(b.latitude - _lat) / 2), 2)
              + cos(radians(_lat)) * cos(radians(b.latitude))
              * power(sin(radians(b.longitude - _lng) / 2), 2)))
         END AS distance_km,
         t.title, t.subtitle, t.corner_title, t.description, t.total_steps, t.grid_cols,
         t.shape, t.bg_color, t.accent_color, t.text_color, t.stamp_icon, t.logo_url,
         t.rewards, t.created_at
  FROM public.card_templates t
  JOIN public.businesses b ON b.id = t.business_id
  WHERE t.active = true
    AND (
      _q IS NULL OR btrim(_q) = '' OR
      b.name ILIKE '%' || _q || '%' OR
      COALESCE(b.category, '') ILIKE '%' || _q || '%' OR
      COALESCE(b.city, '') ILIKE '%' || _q || '%' OR
      t.title ILIKE '%' || _q || '%' OR
      COALESCE(t.subtitle, '') ILIKE '%' || _q || '%' OR
      COALESCE(t.description, '') ILIKE '%' || _q || '%'
    )
  ORDER BY distance_km ASC NULLS LAST, t.created_at DESC
  LIMIT LEAST(COALESCE(_limit, 200), 500);
$$;

REVOKE ALL ON FUNCTION public.discover_cards(double precision, double precision, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_cards(double precision, double precision, text, integer) TO anon, authenticated;