
-- Public view exposing safe business fields to everyone
CREATE OR REPLACE VIEW public.businesses_public
WITH (security_invoker = on) AS
SELECT id, name, slug, logo_url, brand_color, created_at
FROM public.businesses;

GRANT SELECT ON public.businesses_public TO anon, authenticated;

-- Allow anon/auth to read businesses row via the view (view uses invoker rights, so base table needs a policy)
DROP POLICY IF EXISTS "Public can read business basics" ON public.businesses;
CREATE POLICY "Public can read business basics"
ON public.businesses FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT (id, name, slug, logo_url, brand_color, created_at) ON public.businesses TO anon;
