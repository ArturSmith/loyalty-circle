
DROP POLICY IF EXISTS "Public can read business basics" ON public.businesses;
REVOKE SELECT ON public.businesses FROM anon;

CREATE OR REPLACE VIEW public.businesses_public
WITH (security_invoker = off) AS
SELECT id, name, slug, logo_url, brand_color, created_at
FROM public.businesses;

ALTER VIEW public.businesses_public OWNER TO postgres;
GRANT SELECT ON public.businesses_public TO anon, authenticated;
