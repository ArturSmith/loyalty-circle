
-- 1) Restrict anon exposure of businesses columns (hide owner_id from anon)
REVOKE SELECT ON public.businesses FROM anon;
GRANT SELECT (id, name, logo_url, brand_color, slug, created_at, updated_at) ON public.businesses TO anon;

-- 2) Tighten authenticated visibility of card_templates to active-only.
--    Business owners still see all their own templates via the existing "Owners manage templates" ALL policy.
DROP POLICY IF EXISTS "Templates readable by authenticated" ON public.card_templates;
CREATE POLICY "Active templates readable by authenticated"
  ON public.card_templates FOR SELECT TO authenticated
  USING (active = true);

-- 3) Limit cross-user profile exposure to minimal display fields only (display_name, avatar_url).
--    Bidirectional visibility policies remain, but column privileges keep exposure minimal.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url) ON public.profiles TO authenticated;

-- 4) Prevent authenticated clients from calling the SECURITY DEFINER helper directly.
--    Callers now go through a server function that uses the service role.
REVOKE EXECUTE ON FUNCTION public.get_frozen_business_ids(uuid[]) FROM authenticated;
