-- Businesses as a first-class thing to discover, not just their cards.
--
-- Two changes:
--   1. discover_businesses() — one row per business, with its locations
--      attached, so Discover can list places rather than only card designs.
--   2. Marketplace visibility is finally enforced. Until now discover_cards()
--      ignored businesses.marketplace_status entirely, so the "Keep us private"
--      choice in the onboarding wizard did nothing at all.
--
-- IMPORTANT — read before running:
-- Every business predating this migration is currently discoverable, because
-- the old query had no visibility filter. Enforcing the filter without a
-- backfill would delist all of them at once, so existing rows are marked
-- 'published' to preserve exactly the behaviour they have today.

/* -------------------------------------------------------------- backfill */

update public.businesses
set marketplace_status = 'published'
where marketplace_status = 'unpublished'
  and marketplace_submitted_at is null;

-- There is no moderation queue yet, so anything awaiting review would sit in
-- 'pending' forever. Treat a submission as accepted until a reviewer exists.
update public.businesses
set marketplace_status = 'published'
where marketplace_status = 'pending';

/* ---------------------------------------------------- discover_businesses */

create or replace function public.discover_businesses(
  _lat double precision default null,
  _lng double precision default null,
  _q text default null,
  _limit integer default 100
)
returns table(
  business_id uuid,
  name text,
  logo_url text,
  brand_color text,
  category text,
  description text,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  card_count integer,
  location_count integer,
  locations jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with loc as (
    -- A business may have explicit locations, or only the single address on
    -- the business row itself (everything created before multi-location
    -- support). Union both so neither kind is invisible.
    select l.business_id,
           l.id,
           l.name,
           l.address_line1, l.address_line2, l.city, l.postal_code,
           l.region, l.country, l.phone,
           l.latitude, l.longitude,
           l.is_primary
    from public.business_locations l
    union all
    select b.id,
           b.id,
           coalesce(b.city, b.name),
           b.address_line1, b.address_line2, b.city, b.postal_code,
           b.region, b.country, b.phone,
           b.latitude, b.longitude,
           true
    from public.businesses b
    where not exists (
      select 1 from public.business_locations x where x.business_id = b.id
    )
  ),
  loc_dist as (
    select loc.*,
           case
             when _lat is null or _lng is null
               or loc.latitude is null or loc.longitude is null then null
             else 6371 * 2 * asin(sqrt(
                    power(sin(radians(loc.latitude - _lat) / 2), 2)
                  + cos(radians(_lat)) * cos(radians(loc.latitude))
                  * power(sin(radians(loc.longitude - _lng) / 2), 2)))
           end as distance_km
    from loc
  )
  select b.id,
         b.name,
         b.logo_url,
         b.brand_color,
         b.category,
         b.description,
         b.city,
         b.country,
         b.latitude,
         b.longitude,
         min(d.distance_km) as distance_km,
         (select count(*)::int from public.card_templates t
           where t.business_id = b.id and t.active = true) as card_count,
         count(d.id)::int as location_count,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', d.id,
               'name', d.name,
               'address_line1', d.address_line1,
               'address_line2', d.address_line2,
               'city', d.city,
               'postal_code', d.postal_code,
               'region', d.region,
               'country', d.country,
               'phone', d.phone,
               'latitude', d.latitude,
               'longitude', d.longitude,
               'is_primary', d.is_primary,
               'distance_km', d.distance_km
             )
             order by d.distance_km asc nulls last, d.is_primary desc, d.name asc
           ) filter (where d.id is not null),
           '[]'::jsonb
         ) as locations
  from public.businesses b
  join loc_dist d on d.business_id = b.id
  where b.marketplace_status = 'published'
    -- A business with nothing to collect is noise in a discovery feed.
    and exists (
      select 1 from public.card_templates t
      where t.business_id = b.id and t.active = true
    )
    and (
      _q is null or btrim(_q) = '' or
      b.name ilike '%' || _q || '%' or
      coalesce(b.category, '') ilike '%' || _q || '%' or
      coalesce(b.city, '') ilike '%' || _q || '%' or
      coalesce(b.description, '') ilike '%' || _q || '%' or
      coalesce(d.city, '') ilike '%' || _q || '%' or
      coalesce(d.name, '') ilike '%' || _q || '%'
    )
  group by b.id, b.name, b.logo_url, b.brand_color, b.category,
           b.description, b.city, b.country, b.latitude, b.longitude
  order by distance_km asc nulls last, b.name asc
  limit least(coalesce(_limit, 100), 300);
$$;

revoke all on function public.discover_businesses(double precision, double precision, text, integer) from public;
grant execute on function public.discover_businesses(double precision, double precision, text, integer) to anon, authenticated;

/* ------------------------------------------------- discover_cards, gated */

-- Same query as before plus the visibility filter it was always missing.
create or replace function public.discover_cards(
  _lat double precision default null,
  _lng double precision default null,
  _q text default null,
  _limit integer default 200
)
returns table(
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
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id, b.id, b.name, b.logo_url, b.category, b.city, b.country,
         b.latitude, b.longitude,
         case
           when _lat is null or _lng is null or b.latitude is null or b.longitude is null then null
           else 6371 * 2 * asin(sqrt(
                power(sin(radians(b.latitude - _lat) / 2), 2)
              + cos(radians(_lat)) * cos(radians(b.latitude))
              * power(sin(radians(b.longitude - _lng) / 2), 2)))
         end as distance_km,
         t.title, t.subtitle, t.corner_title, t.description, t.total_steps, t.grid_cols,
         t.shape, t.bg_color, t.accent_color, t.text_color, t.stamp_icon, t.logo_url,
         t.rewards, t.created_at
  from public.card_templates t
  join public.businesses b on b.id = t.business_id
  where t.active = true
    and b.marketplace_status = 'published'
    and (
      _q is null or btrim(_q) = '' or
      b.name ilike '%' || _q || '%' or
      coalesce(b.category, '') ilike '%' || _q || '%' or
      coalesce(b.city, '') ilike '%' || _q || '%' or
      t.title ilike '%' || _q || '%' or
      coalesce(t.subtitle, '') ilike '%' || _q || '%' or
      coalesce(t.description, '') ilike '%' || _q || '%'
    )
  order by distance_km asc nulls last, t.created_at desc
  limit least(coalesce(_limit, 200), 500);
$$;

/* ----------------------------------------------- business detail, public */

-- Locations and socials for the public business page. Kept as its own function
-- so the page makes one round trip instead of two RLS-gated table reads.
create or replace function public.get_business_detail_public(_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'locations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'address_line1', l.address_line1,
          'address_line2', l.address_line2,
          'city', l.city,
          'postal_code', l.postal_code,
          'region', l.region,
          'country', l.country,
          'phone', l.phone,
          'latitude', l.latitude,
          'longitude', l.longitude,
          'is_primary', l.is_primary
        )
        order by l.is_primary desc, l.name asc
      )
      from public.business_locations l
      where l.business_id = _id
    ), '[]'::jsonb),
    'socials', coalesce((
      select jsonb_agg(
        jsonb_build_object('platform', s.platform, 'url', s.url)
        order by s.platform asc
      )
      from public.business_socials s
      where s.business_id = _id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.get_business_detail_public(uuid) from public;
grant execute on function public.get_business_detail_public(uuid) to anon, authenticated;
