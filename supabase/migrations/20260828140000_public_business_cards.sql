-- Public business pages need a deliberately limited card projection. Keeping
-- this behind an RPC avoids granting anonymous callers access to every column
-- in card_templates and guarantees that drafts never leak into the response.

create or replace function public.get_business_cards_public(_id uuid)
returns table(
  id uuid,
  business_id uuid,
  title text,
  subtitle text,
  description text,
  corner_title text,
  total_steps integer,
  shape text,
  bg_color text,
  accent_color text,
  text_color text,
  stamp_icon text,
  logo_url text,
  rewards jsonb,
  active boolean,
  grid_cols smallint,
  terms_and_conditions text,
  terms_version integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    t.business_id,
    t.title,
    t.subtitle,
    t.description,
    t.corner_title,
    t.total_steps,
    t.shape,
    t.bg_color,
    t.accent_color,
    t.text_color,
    t.stamp_icon,
    t.logo_url,
    t.rewards,
    t.active,
    t.grid_cols,
    t.terms_and_conditions,
    t.terms_version
  from public.card_templates t
  join public.businesses b on b.id = t.business_id
  where t.business_id = _id
    and t.active = true
    and t.accepted_by_platform = true
    and b.accepted_by_platform = true
    and b.paused_at is null
  order by t.created_at asc;
$$;

revoke all on function public.get_business_cards_public(uuid) from public;
grant execute on function public.get_business_cards_public(uuid)
  to anon, authenticated, service_role;

