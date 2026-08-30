-- Anon lost table-level SELECT on public.businesses via
-- 20260727082434_6605e282 (REVOKE SELECT ... FROM anon), but RLS policies
-- still intend anonymous reads of accepted businesses:
--   * "Accepted businesses publicly readable" on businesses (direct reads)
--   * "Accepted templates/locations/socials publicly readable" policies
--     subquery businesses in their USING clause; those subqueries run as the
--     querying role and fail with "permission denied for table businesses".
-- Restore a column-limited grant covering only public display fields plus
-- the acceptance flag the sibling policies evaluate.

GRANT SELECT (
  id,
  name,
  slug,
  logo_url,
  brand_color,
  category,
  description,
  welcome_message,
  phone,
  website,
  address_line1,
  address_line2,
  city,
  postal_code,
  region,
  country,
  latitude,
  longitude,
  created_at,
  accepted_by_platform
) ON public.businesses TO anon;