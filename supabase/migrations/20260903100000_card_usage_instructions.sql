-- AI usage copy is distinct from accepted terms. Apply before deploying the UI.
-- Existing terms, acceptance versions and card content are not rewritten.
begin;

alter table public.card_templates add column if not exists usage_instructions text;
alter table public.card_templates add constraint card_usage_instructions_length
  check (usage_instructions is null or length(btrim(usage_instructions)) between 10 and 20000);
comment on column public.card_templates.usage_instructions is
  'Reviewed AI-generated How to use this card instructions; not terms or consent text.';

create or replace function public.moderation_card_snapshot(_template_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('card', jsonb_build_object(
    'title', t.title,
    'subtitle', t.subtitle,
    'description', t.description,
    'corner_title', t.corner_title,
    'total_steps', t.total_steps,
    'shape', t.shape,
    'bg_color', t.bg_color,
    'accent_color', t.accent_color,
    'text_color', t.text_color,
    'stamp_icon', t.stamp_icon,
    'stamp_shape', t.stamp_shape,
    'step_size', t.step_size,
    'logo_url', t.logo_url,
    'rewards', t.rewards,
    'grid_cols', t.grid_cols,
    'active', t.active,
    'terms_and_conditions', t.terms_and_conditions,
    'usage_instructions', t.usage_instructions
  ))
  from public.card_templates t
  where t.id = _template_id;
$$;

create or replace function public.guard_moderated_card_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.accepted_by_platform := false;
    elsif new.accepted_by_platform is distinct from old.accepted_by_platform then
      raise exception 'Only the platform can change card acceptance';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('app.moderation_apply', true), '') <> '1'
     and old.accepted_by_platform
     and row(
       new.title, new.subtitle, new.description, new.corner_title,
       new.total_steps, new.shape, new.bg_color, new.accent_color,
       new.text_color, new.stamp_icon, new.stamp_shape, new.step_size,
       new.logo_url, new.rewards, new.grid_cols, new.active,
       new.terms_and_conditions, new.usage_instructions
     ) is distinct from row(
       old.title, old.subtitle, old.description, old.corner_title,
       old.total_steps, old.shape, old.bg_color, old.accent_color,
       old.text_color, old.stamp_icon, old.stamp_shape, old.step_size,
       old.logo_url, old.rewards, old.grid_cols, old.active,
       old.terms_and_conditions, old.usage_instructions
     ) then
    raise exception 'Card changes must be submitted for platform moderation';
  end if;
  return new;
end;
$$;

create or replace function public.submit_card_changes(
  _template_id uuid,
  _changes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.card_templates%rowtype;
  v_next public.card_templates%rowtype;
  v_proposed jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(jsonb_typeof(_changes), '') <> 'object' then raise exception 'Card changes must be an object'; end if;
  if exists (
    select 1 from jsonb_object_keys(_changes) as keys(key)
    where key <> all(array[
      'title','subtitle','description','corner_title','total_steps','shape',
      'bg_color','accent_color','text_color','stamp_icon','stamp_shape',
      'step_size','logo_url','rewards','grid_cols','active','terms_and_conditions','usage_instructions'
    ])
  ) then
    raise exception 'Unsupported card field';
  end if;

  if _changes->>'usage_instructions' is not null and
     length(btrim(_changes->>'usage_instructions')) not between 10 and 20000 then
    raise exception 'Invalid card usage instructions';
  end if;

  select * into v_card from public.card_templates where id = _template_id for update;
  if not found then raise exception 'Card not found'; end if;
  if not public.can_on_business(v_card.business_id, 'cards.manage') then
    raise exception 'Not authorized to manage this card';
  end if;

  if v_card.accepted_by_platform then
    select proposed_data into v_proposed
    from public.moderation_submissions
    where entity_type = 'card' and entity_id = _template_id and status = 'pending';
    v_proposed := coalesce(v_proposed, public.moderation_card_snapshot(_template_id));
    -- Older clients do not know about usage copy. Do not retain it when they
    -- change the facts it describes; the public UI falls back to calculations.
    if not (_changes ? 'usage_instructions') and (
      (_changes ? 'title' and _changes->'title' is distinct from v_proposed->'card'->'title') or
      (_changes ? 'subtitle' and _changes->'subtitle' is distinct from v_proposed->'card'->'subtitle') or
      (_changes ? 'total_steps' and _changes->'total_steps' is distinct from v_proposed->'card'->'total_steps') or
      (_changes ? 'rewards' and _changes->'rewards' is distinct from v_proposed->'card'->'rewards')
    ) then
      _changes := _changes || '{"usage_instructions":null}'::jsonb;
    end if;
    v_proposed := jsonb_set(v_proposed, '{card}', coalesce(v_proposed->'card', '{}'::jsonb) || _changes);
    if length(btrim(coalesce(v_proposed->'card'->>'title', ''))) < 1 then raise exception 'Card title is required'; end if;
    if length(btrim(coalesce(v_proposed->'card'->>'terms_and_conditions', ''))) < 10 then raise exception 'Card terms are required'; end if;
    return public.upsert_moderation_submission(
      'card', _template_id, v_card.business_id, 'update', v_proposed, auth.uid()
    );
  end if;

  v_next := jsonb_populate_record(v_card, _changes);
  if not (_changes ? 'usage_instructions') and
     row(v_next.title, v_next.subtitle, v_next.total_steps, v_next.rewards)
     is distinct from row(v_card.title, v_card.subtitle, v_card.total_steps, v_card.rewards) then
    v_next.usage_instructions := null;
  end if;
  if length(btrim(coalesce(v_next.title, ''))) < 1 then raise exception 'Card title is required'; end if;
  if length(btrim(coalesce(v_next.terms_and_conditions, ''))) < 10 then raise exception 'Card terms are required'; end if;
  perform set_config('app.moderation_apply', '1', true);
  update public.card_templates set
    title = v_next.title,
    subtitle = v_next.subtitle,
    description = v_next.description,
    corner_title = v_next.corner_title,
    total_steps = v_next.total_steps,
    shape = v_next.shape,
    bg_color = v_next.bg_color,
    accent_color = v_next.accent_color,
    text_color = v_next.text_color,
    stamp_icon = v_next.stamp_icon,
    stamp_shape = v_next.stamp_shape,
    step_size = v_next.step_size,
    logo_url = v_next.logo_url,
    rewards = v_next.rewards,
    grid_cols = v_next.grid_cols,
    active = v_next.active,
    terms_and_conditions = v_next.terms_and_conditions,
    usage_instructions = v_next.usage_instructions,
    updated_at = now()
  where id = _template_id;
  perform set_config('app.moderation_apply', '0', true);
  return public.refresh_card_moderation(_template_id, 'create', auth.uid());
end;
$$;

create or replace function public.review_moderation_submission(
  _submission_id uuid,
  _decision text,
  _reviewer_id uuid,
  _reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.moderation_submissions%rowtype;
  v_data jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Platform service role required';
  end if;
  if _decision not in ('accepted', 'rejected') then raise exception 'Invalid moderation decision'; end if;
  if not exists (
    select 1 from public.user_roles where user_id = _reviewer_id and role = 'admin'
  ) then raise exception 'Reviewer is not a platform admin'; end if;
  if _decision = 'rejected' and length(btrim(coalesce(_reason, ''))) < 3 then
    raise exception 'A rejection reason is required';
  end if;

  select * into v_submission from public.moderation_submissions
  where id = _submission_id for update;
  if not found then raise exception 'Moderation submission not found'; end if;
  if v_submission.status <> 'pending' then raise exception 'Submission was already reviewed'; end if;

  if _decision = 'accepted' and v_submission.entity_type = 'business' then
    v_data := v_submission.proposed_data->'business';
    if length(btrim(coalesce(v_data->>'name', ''))) < 2 then raise exception 'Business name is required'; end if;
    perform set_config('app.moderation_apply', '1', true);
    update public.businesses set
      name = v_data->>'name',
      category = v_data->>'category',
      logo_url = v_data->>'logo_url',
      brand_color = v_data->>'brand_color',
      description = v_data->>'description',
      welcome_message = v_data->>'welcome_message',
      phone = v_data->>'phone',
      website = v_data->>'website',
      address_line1 = v_data->>'address_line1',
      address_line2 = v_data->>'address_line2',
      city = v_data->>'city',
      postal_code = v_data->>'postal_code',
      region = v_data->>'region',
      country = v_data->>'country',
      latitude = (v_data->>'latitude')::double precision,
      longitude = (v_data->>'longitude')::double precision,
      accepted_by_platform = true,
      updated_at = now()
    where id = v_submission.entity_id;
    if not found then raise exception 'Business no longer exists'; end if;

    delete from public.business_locations where business_id = v_submission.business_id;
    insert into public.business_locations (
      id, business_id, name, address_line1, address_line2, city, region,
      postal_code, country, phone, latitude, longitude, is_primary
    )
    select coalesce(nullif(x->>'id', '')::uuid, gen_random_uuid()),
      v_submission.business_id, x->>'name', x->>'address_line1',
      x->>'address_line2', x->>'city', x->>'region', x->>'postal_code',
      x->>'country', x->>'phone', (x->>'latitude')::double precision,
      (x->>'longitude')::double precision, coalesce((x->>'is_primary')::boolean, false)
    from jsonb_array_elements(coalesce(v_submission.proposed_data->'locations', '[]'::jsonb)) x;

    delete from public.business_socials where business_id = v_submission.business_id;
    insert into public.business_socials (business_id, platform, url)
    select v_submission.business_id, x->>'platform', x->>'url'
    from jsonb_array_elements(coalesce(v_submission.proposed_data->'socials', '[]'::jsonb)) x;
    perform set_config('app.moderation_apply', '0', true);
  elsif _decision = 'accepted' and v_submission.entity_type = 'card' then
    v_data := v_submission.proposed_data->'card';
    if length(btrim(coalesce(v_data->>'title', ''))) < 1 then raise exception 'Card title is required'; end if;
    if length(btrim(coalesce(v_data->>'terms_and_conditions', ''))) < 10 then raise exception 'Card terms are required'; end if;
    perform set_config('app.moderation_apply', '1', true);
    update public.card_templates set
      title = v_data->>'title',
      subtitle = v_data->>'subtitle',
      description = v_data->>'description',
      corner_title = v_data->>'corner_title',
      total_steps = (v_data->>'total_steps')::integer,
      shape = v_data->>'shape',
      bg_color = v_data->>'bg_color',
      accent_color = v_data->>'accent_color',
      text_color = v_data->>'text_color',
      stamp_icon = v_data->>'stamp_icon',
      stamp_shape = v_data->>'stamp_shape',
      step_size = v_data->>'step_size',
      logo_url = v_data->>'logo_url',
      rewards = coalesce(v_data->'rewards', '[]'::jsonb),
      grid_cols = (v_data->>'grid_cols')::smallint,
      active = coalesce((v_data->>'active')::boolean, true),
      terms_and_conditions = v_data->>'terms_and_conditions',
      usage_instructions = v_data->>'usage_instructions',
      accepted_by_platform = true,
      updated_at = now()
    where id = v_submission.entity_id;
    if not found then raise exception 'Card no longer exists'; end if;
    perform set_config('app.moderation_apply', '0', true);
  end if;

  update public.moderation_submissions set
    status = _decision,
    reviewed_by = _reviewer_id,
    reviewed_at = now(),
    rejection_reason = case when _decision = 'rejected' then btrim(_reason) else null end,
    updated_at = now()
  where id = _submission_id;
end;
$$;

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
      'step_size','logo_url','rewards','grid_cols','active','terms_and_conditions','usage_instructions'
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
      step_size, logo_url, rewards, grid_cols, active, terms_and_conditions, usage_instructions
    ) values (
      v_card_id, _business_id, btrim(v_card.title), v_card.subtitle, v_card.description,
      v_card.corner_title, v_card.total_steps, coalesce(v_card.shape, 'rounded'),
      coalesce(v_card.bg_color, '#faf7ee'), coalesce(v_card.accent_color, '#1a1a2e'),
      coalesce(v_card.text_color, '#1a1a2e'), coalesce(v_card.stamp_icon, 'star'),
      coalesce(v_card.stamp_shape, 'circle'), coalesce(v_card.step_size, 'medium'),
      v_card.logo_url, v_card.rewards, v_card.grid_cols, coalesce(v_card.active, true),
      btrim(v_card.terms_and_conditions), v_card.usage_instructions
    ) on conflict (id) do update set
      title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,
      corner_title = excluded.corner_title, total_steps = excluded.total_steps,
      shape = excluded.shape, bg_color = excluded.bg_color, accent_color = excluded.accent_color,
      text_color = excluded.text_color, stamp_icon = excluded.stamp_icon,
      stamp_shape = excluded.stamp_shape, step_size = excluded.step_size,
      logo_url = excluded.logo_url, rewards = excluded.rewards, grid_cols = excluded.grid_cols,
      active = excluded.active, terms_and_conditions = excluded.terms_and_conditions,
      usage_instructions = excluded.usage_instructions, updated_at = now();
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
         new.terms_and_conditions, new.usage_instructions
       ) is distinct from row(
         old.title, old.subtitle, old.description, old.corner_title,
         old.total_steps, old.shape, old.bg_color, old.accent_color,
         old.text_color, old.stamp_icon, old.stamp_shape, old.step_size,
         old.logo_url, old.rewards, old.grid_cols, old.active,
         old.terms_and_conditions, old.usage_instructions
       ) then
      perform public.refresh_card_moderation(new.id, 'create', auth.uid());
    end if;
  end if;
  return new;
end;
$$;

-- The public projection has a new output column; replace atomically and restore
-- exactly the same visibility checks and caller grants, without CASCADE.
drop function public.get_business_cards_public(uuid);
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
  terms_version integer,
  usage_instructions text
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
    t.terms_version,
    t.usage_instructions
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



notify pgrst, 'reload schema';
commit;
