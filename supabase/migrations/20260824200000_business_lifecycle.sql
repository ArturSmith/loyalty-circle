-- Lifecycle controls for a business: paused, deleted, and delisted when unpaid.
--
-- Three problems this fixes:
--
--   1. Marketplace visibility was never tied to billing. A business whose
--      trial had expired and which had no subscription stayed listed in
--      Discover indefinitely — we were advertising customers who had stopped
--      paying, and sending people to cards that can no longer be stamped
--      (add_stamp already refuses via business_has_access_v2).
--
--   2. There was no way to pause. The only lever was deleting everything.
--
--   3. There was no way to delete either. Nothing in the app or the RLS
--      policies allowed an owner to remove their own business.
--
-- Visibility is enforced in the read functions rather than by rewriting
-- marketplace_status on a schedule: the owner's stated preference is worth
-- keeping, so that resubscribing restores the listing without them having to
-- remember they were once public. The column records the *intent*; these
-- functions decide the *effect*.

/* ---------------------------------------------------------------- columns */

alter table public.businesses
  add column if not exists paused_at timestamptz;

comment on column public.businesses.paused_at is
  'Set by the owner to take the business off Discover and stop new sign-ups. '
  'Existing cards keep working; null means active.';

/* -------------------------------------------------- listing eligibility */

-- One place that decides whether a business may appear publicly, so the
-- discover feed and the public page cannot drift apart.
create or replace function public.business_is_listable(_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = _business_id
      and b.marketplace_status = 'published'
      and b.paused_at is null
  )
  -- Trial expired and nothing paid for: delist until they come back.
  and public.business_has_access_v2(_business_id, 'live');
$$;

revoke all on function public.business_is_listable(uuid) from public, anon, authenticated;
grant execute on function public.business_is_listable(uuid) to anon, authenticated, service_role;

/* --------------------------------------------------------- discover feeds */

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
  where public.business_is_listable(b.id)
    and exists (
      select 1 from public.card_templates t
      where t.business_id = b.id and t.active = true
    )
    and (
      _q is null or btrim(_q) = '' or
      b.name ilike '%' || _q || '%' or
      coalesce(b.category, '') ilike '%' || _q || '%' or
      coalesce(b.city, '') ilike '%' || _q || '%'
    )
  group by b.id
  order by min(d.distance_km) asc nulls last, b.name asc
  limit greatest(1, least(coalesce(_limit, 100), 200));
$$;

revoke all on function public.discover_businesses(double precision, double precision, text, integer)
  from public, anon, authenticated;
grant execute on function public.discover_businesses(double precision, double precision, text, integer)
  to anon, authenticated, service_role;

/* ------------------------------------------------- discover_cards, gated */

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
    and public.business_is_listable(b.id)
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

revoke all on function public.discover_cards(double precision, double precision, text, integer)
  from public, anon, authenticated;
grant execute on function public.discover_cards(double precision, double precision, text, integer)
  to anon, authenticated, service_role;

/* ------------------------------------------------------- the public page */

-- The page itself is reached by QR code and direct link, so it stays
-- reachable while unpaid — but a paused business is deliberately closed for
-- business, and returning nothing is what stops new sign-ups there.
create or replace function public.get_business_public(_id uuid)
returns table(
  id uuid, name text, slug text, logo_url text, brand_color text, created_at timestamptz,
  category text, description text, welcome_message text, phone text, website text,
  address_line1 text, address_line2 text, city text, postal_code text, region text, country text,
  latitude double precision, longitude double precision
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.name, b.slug, b.logo_url, b.brand_color, b.created_at,
         b.category, b.description, b.welcome_message, b.phone, b.website,
         b.address_line1, b.address_line2, b.city, b.postal_code, b.region, b.country,
         b.latitude, b.longitude
  from public.businesses b
  where b.id = _id
    and b.paused_at is null;
$$;

grant execute on function public.get_business_public(uuid) to anon, authenticated, service_role;

/* ------------------------------------------------------------ pause/resume */

create or replace function public.set_business_paused(_business_id uuid, _paused boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.businesses where id = _business_id;
  if v_owner is null then
    raise exception 'Business not found';
  end if;
  -- Deliberately owner-only: invited administrators can run the business
  -- day to day, but taking it offline is not theirs to decide.
  if v_owner <> auth.uid() then
    raise exception 'Only the owner can pause or resume this business';
  end if;

  update public.businesses
  set paused_at = case when _paused then now() else null end,
      updated_at = now()
  where id = _business_id;
end;
$$;

revoke all on function public.set_business_paused(uuid, boolean) from public, anon;
grant execute on function public.set_business_paused(uuid, boolean) to authenticated, service_role;

/* ----------------------------------------------------------------- delete */

create or replace function public.delete_business(_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.businesses where id = _business_id;
  if v_owner is null then
    raise exception 'Business not found';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'Only the owner can delete this business';
  end if;

  -- Every dependent table declares ON DELETE CASCADE, so cards, templates,
  -- locations, socials and memberships go with it. Customers' stamp cards are
  -- destroyed too, which is why the UI asks the owner to type the name.
  delete from public.businesses where id = _business_id;
end;
$$;

revoke all on function public.delete_business(uuid) from public, anon;
grant execute on function public.delete_business(uuid) to authenticated, service_role;
