-- Unaccepted businesses and cards are visible to their own teams and platform
-- staff, but never through public table reads, Discover, QR pages, or claims.

/* ----------------------------------------------------------- public RLS */

drop policy if exists "Businesses publicly readable" on public.businesses;
create policy "Accepted businesses publicly readable" on public.businesses
  for select to anon, authenticated
  using (accepted_by_platform = true);

drop policy if exists "Templates publicly readable" on public.card_templates;
create policy "Accepted templates publicly readable" on public.card_templates
  for select to anon, authenticated
  using (
    accepted_by_platform = true
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.accepted_by_platform = true
    )
  );

drop policy if exists "Locations publicly readable" on public.business_locations;
create policy "Accepted business locations publicly readable" on public.business_locations
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.accepted_by_platform = true
    )
  );

drop policy if exists "Socials publicly readable" on public.business_socials;
create policy "Accepted business socials publicly readable" on public.business_socials
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.businesses b
      where b.id = business_id and b.accepted_by_platform = true
    )
  );

/* -------------------------------------------------- listing eligibility */

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
      and b.accepted_by_platform = true
      and b.marketplace_status = 'published'
      and b.paused_at is null
  )
  and public.business_has_access_v2(_business_id, 'live');
$$;

/* --------------------------------------------------------- discover feed */

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
           where t.business_id = b.id
             and t.active = true
             and t.accepted_by_platform = true) as card_count,
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
      where t.business_id = b.id
        and t.active = true
        and t.accepted_by_platform = true
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
    and t.accepted_by_platform = true
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

/* ------------------------------------------------------- public QR page */

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
    and b.accepted_by_platform = true
    and b.paused_at is null;
$$;

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
        ) order by l.is_primary desc, l.name asc
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
  )
  from public.businesses b
  where b.id = _id
    and b.accepted_by_platform = true
    and b.paused_at is null;
$$;

-- Pending cards are visible in the owner's workspace, but they are not active
-- loyalty programs until platform acceptance.
create or replace function public.get_business_dashboard_stats(_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_stamps bigint;
  v_customers bigint;
  v_active_cards bigint;
begin
  if auth.uid() is null or not public.is_business_member(_business_id, auth.uid()) then
    raise exception 'Not authorized to view this business';
  end if;

  select count(*) into v_stamps from public.stamps where business_id = _business_id;
  select count(distinct ci.customer_id) into v_customers
  from public.card_instances ci
  join public.card_templates t on t.id = ci.template_id
  where t.business_id = _business_id;
  select count(*) into v_active_cards
  from public.card_templates
  where business_id = _business_id
    and active = true
    and accepted_by_platform = true;

  return jsonb_build_object('stamps', v_stamps, 'customers', v_customers, 'active', v_active_cards);
end;
$$;
