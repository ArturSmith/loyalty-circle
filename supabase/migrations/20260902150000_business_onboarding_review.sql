-- Submit a complete business and its first card atomically as private drafts.
-- Existing accepted businesses, cards, and moderation history are preserved.
-- Apply this migration before deploying the new onboarding UI.
begin;

create or replace function public.submit_business_onboarding(
  _business_id uuid,
  _business jsonb,
  _card jsonb,
  _socials jsonb default '[]'::jsonb,
  _marketplace text default 'unpublished',
  _card_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_card public.card_templates%rowtype;
  v_card_id uuid;
  v_card_accepted boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if _business_id is null then raise exception 'Business ID is required'; end if;
  if coalesce(jsonb_typeof(_business), '') <> 'object' then raise exception 'Business details are required'; end if;
  if length(btrim(coalesce(_business->>'name', ''))) < 2
     or length(btrim(coalesce(_business->>'name', ''))) > 100
     or length(btrim(coalesce(_business->>'category', ''))) = 0
     or length(btrim(coalesce(_business->>'address_line1', ''))) < 3
     or length(btrim(coalesce(_business->>'city', ''))) = 0
     or length(btrim(coalesce(_business->>'postal_code', ''))) = 0
     or length(btrim(coalesce(_business->>'country', ''))) = 0 then
    raise exception 'Please fill in name, category and full address';
  end if;
  if _marketplace is null or _marketplace not in ('published', 'unpublished') then
    raise exception 'Invalid marketplace choice';
  end if;
  if coalesce(jsonb_typeof(_card), '') <> 'object'
     or length(btrim(coalesce(_card->>'title', ''))) < 1
     or length(btrim(coalesce(_card->>'terms_and_conditions', ''))) < 10
     or length(coalesce(_card->>'terms_and_conditions', '')) > 20000 then
    raise exception 'A first loyalty card with a title and terms is required';
  end if;
  if exists (
    select 1 from jsonb_object_keys(_card) keys(key)
    where key <> all(array[
      'title','subtitle','description','corner_title','total_steps','shape',
      'bg_color','accent_color','text_color','stamp_icon','stamp_shape',
      'step_size','logo_url','rewards','grid_cols','active','terms_and_conditions'
    ])
  ) then raise exception 'Unsupported card field'; end if;
  v_card := jsonb_populate_record(null::public.card_templates, _card);
  if v_card.total_steps is null or v_card.total_steps not between 0 and 32 then
    raise exception 'Total steps must be between 0 and 32';
  end if;
  if coalesce(jsonb_typeof(_card->'rewards'), '') <> 'array' then raise exception 'Invalid card rewards'; end if;
  if exists (select 1 from jsonb_array_elements(_card->'rewards') r
      where coalesce((r->>'step')::integer, 0) not between 1 and v_card.total_steps
        or length(btrim(coalesce(r->>'label', ''))) = 0) then
    raise exception 'Invalid card reward';
  end if;

  -- Retries/double taps with the same draft ID cannot create duplicates.
  perform pg_advisory_xact_lock(hashtextextended(_business_id::text, 0));
  select * into v_business from public.businesses where id = _business_id for update;
  if found then
    if v_business.owner_id <> auth.uid() then raise exception 'Only the owner can submit this business'; end if;
    if v_business.accepted_by_platform then raise exception 'Business is already approved'; end if;
    -- Suppress per-field queue refreshes until all draft data is saved.
    update public.businesses set onboarding_completed_at = null where id = _business_id;
  else
    insert into public.businesses (id, owner_id, name, accepted_by_platform)
    values (_business_id, auth.uid(), btrim(_business->>'name'), false);
  end if;

  perform public.submit_business_changes(_business_id, _business);
  perform public.submit_business_socials(_business_id, _socials);

  select id, accepted_by_platform into v_card_id, v_card_accepted
  from public.card_templates
  where business_id = _business_id and (_card_id is null or id = _card_id)
  order by created_at, id limit 1 for update;
  if _card_id is not null and v_card_id is null then raise exception 'Card does not belong to this business'; end if;

  if coalesce(v_card_accepted, false) then
    -- A moderator may have already accepted the card while the business is
    -- pending. Preserve that accepted version and stage any edits as usual.
    perform public.submit_card_changes(v_card_id, _card);
  else
    v_card_id := coalesce(v_card_id, gen_random_uuid());
    insert into public.card_templates (
      id, business_id, title, subtitle, description, corner_title, total_steps,
      shape, bg_color, accent_color, text_color, stamp_icon, stamp_shape,
      step_size, logo_url, rewards, grid_cols, active, terms_and_conditions
    ) values (
      v_card_id, _business_id, btrim(v_card.title), v_card.subtitle, v_card.description,
      v_card.corner_title, v_card.total_steps, coalesce(v_card.shape, 'rounded'),
      coalesce(v_card.bg_color, '#faf7ee'), coalesce(v_card.accent_color, '#1a1a2e'),
      coalesce(v_card.text_color, '#1a1a2e'), coalesce(v_card.stamp_icon, 'star'),
      coalesce(v_card.stamp_shape, 'circle'), coalesce(v_card.step_size, 'medium'),
      v_card.logo_url, v_card.rewards, v_card.grid_cols, coalesce(v_card.active, true),
      btrim(v_card.terms_and_conditions)
    ) on conflict (id) do update set
      title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,
      corner_title = excluded.corner_title, total_steps = excluded.total_steps,
      shape = excluded.shape, bg_color = excluded.bg_color, accent_color = excluded.accent_color,
      text_color = excluded.text_color, stamp_icon = excluded.stamp_icon,
      stamp_shape = excluded.stamp_shape, step_size = excluded.step_size,
      logo_url = excluded.logo_url, rewards = excluded.rewards, grid_cols = excluded.grid_cols,
      active = excluded.active, terms_and_conditions = excluded.terms_and_conditions, updated_at = now();
  end if;

  -- One business submission and one first-card submission; no partial setup
  -- is visible to moderators if any earlier write fails.
  update public.businesses set
    onboarding_step = 7, onboarding_completed_at = now(),
    marketplace_status = _marketplace,
    marketplace_submitted_at = case when _marketplace = 'published' then now() else null end,
    updated_at = now()
  where id = _business_id;
  if not coalesce(v_card_accepted, false) then
    perform public.refresh_card_moderation(v_card_id, 'create', auth.uid());
  end if;
  return _business_id;
end;
$$;

revoke all on function public.submit_business_onboarding(uuid, jsonb, jsonb, jsonb, text, uuid) from public, anon;
grant execute on function public.submit_business_onboarding(uuid, jsonb, jsonb, jsonb, text, uuid) to authenticated;

-- First-card enforcement also applies to attempts to finish onboarding via
-- direct table updates, not only through the application.
create or replace function public.require_first_onboarding_card()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.onboarding_completed_at is not null and not new.accepted_by_platform
     and (tg_op = 'INSERT' or old.onboarding_completed_at is null) then
    if not exists (select 1 from public.card_templates t where t.business_id = new.id
      and length(btrim(t.title)) > 0 and length(btrim(t.terms_and_conditions)) >= 10) then
      raise exception 'Create your first loyalty card before submitting your business';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists require_first_onboarding_card_trg on public.businesses;
create trigger require_first_onboarding_card_trg before insert or update on public.businesses
for each row execute function public.require_first_onboarding_card();
revoke all on function public.require_first_onboarding_card() from public, anon, authenticated;

-- Pending drafts neither start a trial nor consume paid business seats.
create or replace function public.start_trial_on_first_business()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_consumed timestamptz;
begin
  if not new.accepted_by_platform then return new; end if;
  if tg_op = 'UPDATE' and old.accepted_by_platform then return new; end if;
  if new.trial_started_at is not null then return new; end if;
  insert into public.profiles (id) values (new.owner_id) on conflict (id) do nothing;
  select trial_consumed_at into v_consumed from public.profiles where id = new.owner_id for update;
  if v_consumed is null then
    new.trial_started_at := now();
    update public.profiles set trial_consumed_at = now(), trial_started_at = coalesce(trial_started_at, now())
    where id = new.owner_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_start_trial_on_first_business on public.businesses;
create trigger trg_start_trial_on_first_business before insert or update of accepted_by_platform on public.businesses
for each row execute function public.start_trial_on_first_business();

create or replace function public.business_slot_rank(_business_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select rnk::integer from (
    select b.id, row_number() over (partition by b.owner_id order by b.created_at, b.id) rnk
    from public.businesses b
    where b.owner_id = (select owner_id from public.businesses where id = _business_id)
      and not b.comped and b.accepted_by_platform
  ) ranked where id = _business_id;
$$;

create or replace function public.guard_business_slot()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_existing integer; v_subs integer;
begin
  if not new.accepted_by_platform or new.comped then return new; end if;
  select count(*)::integer into v_existing from public.businesses
  where owner_id = new.owner_id and not comped and accepted_by_platform;
  if v_existing = 0 then return new; end if;
  select greatest(public.active_subscription_count(new.owner_id, 'live'), public.active_subscription_count(new.owner_id, 'sandbox')) into v_subs;
  if v_subs >= v_existing + 1 then return new; end if;
  raise exception 'Each business needs its own subscription. Subscribe again to add another business.';
end;
$$;

create or replace function public.business_has_access_v2(_business_id uuid, _env text default 'live')
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_business public.businesses%rowtype;
begin
  select * into v_business from public.businesses where id = _business_id;
  if not found or not v_business.accepted_by_platform then return false; end if;
  if v_business.comped then return true; end if;
  if public.active_subscription_count(v_business.owner_id, _env) >= public.business_slot_rank(_business_id) then return true; end if;
  return public.business_trial_active(_business_id);
end;
$$;

create or replace function public.queue_unaccepted_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Do not queue the first card before the complete business draft is submitted.
  if exists (select 1 from public.businesses where id = new.business_id and onboarding_completed_at is null and not accepted_by_platform) then
    return new;
  end if;
  if not new.accepted_by_platform then
    if tg_op = 'INSERT' then
      perform public.refresh_card_moderation(new.id, 'create', auth.uid());
    elsif row(
         new.title, new.subtitle, new.description, new.corner_title,
         new.total_steps, new.shape, new.bg_color, new.accent_color,
         new.text_color, new.stamp_icon, new.stamp_shape, new.step_size,
         new.logo_url, new.rewards, new.grid_cols, new.active,
         new.terms_and_conditions
       ) is distinct from row(
         old.title, old.subtitle, old.description, old.corner_title,
         old.total_steps, old.shape, old.bg_color, old.accent_color,
         old.text_color, old.stamp_icon, old.stamp_shape, old.step_size,
         old.logo_url, old.rewards, old.grid_cols, old.active,
         old.terms_and_conditions
       ) then
      perform public.refresh_card_moderation(new.id, 'create', auth.uid());
    end if;
  end if;
  return new;
end;
$$;

commit;
