-- End-to-end moderation for businesses and loyalty-card templates.
--
-- New entities are stored as private drafts. Changes to an already accepted
-- entity are staged in moderation_submissions, leaving the accepted version
-- untouched until a ClubCarder staff reviewer accepts the submission.

/* --------------------------------------------------------------- schema */

alter table public.card_templates
  add column if not exists accepted_by_platform boolean;

update public.card_templates
set accepted_by_platform = true
where accepted_by_platform is null;

alter table public.card_templates
  alter column accepted_by_platform set default false,
  alter column accepted_by_platform set not null;

comment on column public.card_templates.accepted_by_platform is
  'Whether the platform has accepted this card template for publication.';

create table if not exists public.moderation_submissions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('business', 'card')),
  entity_id uuid not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  change_kind text not null check (change_kind in ('create', 'update')),
  proposed_data jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists moderation_one_pending_per_entity_idx
  on public.moderation_submissions(entity_type, entity_id)
  where status = 'pending';

create index if not exists moderation_pending_queue_idx
  on public.moderation_submissions(status, submitted_at desc);

alter table public.moderation_submissions enable row level security;
grant select on public.moderation_submissions to authenticated;
grant all on public.moderation_submissions to service_role;

drop policy if exists "Business team reads moderation" on public.moderation_submissions;
create policy "Business team reads moderation" on public.moderation_submissions
  for select to authenticated
  using (public.is_business_member(business_id, auth.uid()));

/* ------------------------------------------------------------ snapshots */

create or replace function public.moderation_business_snapshot(_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'business', jsonb_build_object(
      'name', b.name,
      'category', b.category,
      'logo_url', b.logo_url,
      'brand_color', b.brand_color,
      'description', b.description,
      'welcome_message', b.welcome_message,
      'phone', b.phone,
      'website', b.website,
      'address_line1', b.address_line1,
      'address_line2', b.address_line2,
      'city', b.city,
      'postal_code', b.postal_code,
      'region', b.region,
      'country', b.country,
      'latitude', b.latitude,
      'longitude', b.longitude
    ),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'address_line1', l.address_line1,
        'address_line2', l.address_line2,
        'city', l.city,
        'region', l.region,
        'postal_code', l.postal_code,
        'country', l.country,
        'phone', l.phone,
        'latitude', l.latitude,
        'longitude', l.longitude,
        'is_primary', l.is_primary
      ) order by l.is_primary desc, l.created_at asc)
      from public.business_locations l
      where l.business_id = b.id
    ), '[]'::jsonb),
    'socials', coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', s.platform,
        'url', s.url
      ) order by s.platform asc)
      from public.business_socials s
      where s.business_id = b.id
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.id = _business_id;
$$;

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
    'terms_and_conditions', t.terms_and_conditions
  ))
  from public.card_templates t
  where t.id = _template_id;
$$;

create or replace function public.upsert_moderation_submission(
  _entity_type text,
  _entity_id uuid,
  _business_id uuid,
  _change_kind text,
  _proposed_data jsonb,
  _submitted_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.moderation_submissions
  where entity_type = _entity_type
    and entity_id = _entity_id
    and status = 'pending'
  for update;

  if v_id is null then
    insert into public.moderation_submissions (
      entity_type, entity_id, business_id, change_kind,
      proposed_data, submitted_by
    ) values (
      _entity_type, _entity_id, _business_id, _change_kind,
      _proposed_data, _submitted_by
    ) returning id into v_id;
  else
    update public.moderation_submissions
    set proposed_data = _proposed_data,
        change_kind = case
          when change_kind = 'create' then 'create'
          else _change_kind
        end,
        submitted_by = coalesce(_submitted_by, submitted_by),
        submitted_at = now(),
        updated_at = now(),
        rejection_reason = null
    where id = v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.refresh_business_moderation(
  _business_id uuid,
  _change_kind text,
  _submitted_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.upsert_moderation_submission(
    'business', _business_id, _business_id, _change_kind,
    public.moderation_business_snapshot(_business_id), _submitted_by
  );
end;
$$;

create or replace function public.refresh_card_moderation(
  _template_id uuid,
  _change_kind text,
  _submitted_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id
  from public.card_templates
  where id = _template_id;

  if v_business_id is null then
    raise exception 'Card not found';
  end if;

  return public.upsert_moderation_submission(
    'card', _template_id, v_business_id, _change_kind,
    public.moderation_card_snapshot(_template_id), _submitted_by
  );
end;
$$;

/* -------------------------------------------------------- write guards */

create or replace function public.guard_moderated_business_changes()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('app.moderation_apply', true), '') <> '1'
     and old.accepted_by_platform
     and row(
       new.name, new.category, new.logo_url, new.brand_color,
       new.description, new.welcome_message, new.phone, new.website,
       new.address_line1, new.address_line2, new.city, new.postal_code,
       new.region, new.country, new.latitude, new.longitude
     ) is distinct from row(
       old.name, old.category, old.logo_url, old.brand_color,
       old.description, old.welcome_message, old.phone, old.website,
       old.address_line1, old.address_line2, old.city, old.postal_code,
       old.region, old.country, old.latitude, old.longitude
     ) then
    raise exception 'Business changes must be submitted for platform moderation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_moderated_business_changes_trg on public.businesses;
create trigger guard_moderated_business_changes_trg
before update on public.businesses
for each row execute function public.guard_moderated_business_changes();

create or replace function public.queue_unaccepted_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.accepted_by_platform and new.onboarding_completed_at is not null then
    if tg_op = 'INSERT' then
      perform public.refresh_business_moderation(new.id, 'create', auth.uid());
    elsif old.onboarding_completed_at is null
       or row(
         new.name, new.category, new.logo_url, new.brand_color,
         new.description, new.welcome_message, new.phone, new.website,
         new.address_line1, new.address_line2, new.city, new.postal_code,
         new.region, new.country, new.latitude, new.longitude
       ) is distinct from row(
         old.name, old.category, old.logo_url, old.brand_color,
         old.description, old.welcome_message, old.phone, old.website,
         old.address_line1, old.address_line2, old.city, old.postal_code,
         old.region, old.country, old.latitude, old.longitude
       ) then
      perform public.refresh_business_moderation(new.id, 'create', auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_unaccepted_business_trg on public.businesses;
create trigger queue_unaccepted_business_trg
after insert or update on public.businesses
for each row execute function public.queue_unaccepted_business();

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
       new.terms_and_conditions
     ) is distinct from row(
       old.title, old.subtitle, old.description, old.corner_title,
       old.total_steps, old.shape, old.bg_color, old.accent_color,
       old.text_color, old.stamp_icon, old.stamp_shape, old.step_size,
       old.logo_url, old.rewards, old.grid_cols, old.active,
       old.terms_and_conditions
     ) then
    raise exception 'Card changes must be submitted for platform moderation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_moderated_card_changes_trg on public.card_templates;
create trigger guard_moderated_card_changes_trg
before insert or update on public.card_templates
for each row execute function public.guard_moderated_card_changes();

create or replace function public.queue_unaccepted_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists queue_unaccepted_card_trg on public.card_templates;
create trigger queue_unaccepted_card_trg
after insert or update on public.card_templates
for each row execute function public.queue_unaccepted_card();

create or replace function public.remove_deleted_card_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.moderation_submissions
  where entity_type = 'card' and entity_id = old.id;
  return old;
end;
$$;

drop trigger if exists remove_deleted_card_moderation_trg on public.card_templates;
create trigger remove_deleted_card_moderation_trg
after delete on public.card_templates
for each row execute function public.remove_deleted_card_moderation();

create or replace function public.guard_moderated_business_child()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business_id uuid := case when tg_op = 'DELETE' then old.business_id else new.business_id end;
  v_accepted boolean;
begin
  select accepted_by_platform into v_accepted
  from public.businesses where id = v_business_id;

  if coalesce(v_accepted, false)
     and coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('app.moderation_apply', true), '') <> '1' then
    raise exception 'Business changes must be submitted for platform moderation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_moderated_locations_trg on public.business_locations;
create trigger guard_moderated_locations_trg
before insert or update or delete on public.business_locations
for each row execute function public.guard_moderated_business_child();

drop trigger if exists guard_moderated_socials_trg on public.business_socials;
create trigger guard_moderated_socials_trg
before insert or update or delete on public.business_socials
for each row execute function public.guard_moderated_business_child();

/* ------------------------------------------------------- submit changes */

create or replace function public.submit_business_changes(
  _business_id uuid,
  _changes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
  v_next public.businesses%rowtype;
  v_proposed jsonb;
  v_submission_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(jsonb_typeof(_changes), '') <> 'object' then
    raise exception 'Business changes must be an object';
  end if;

  if exists (
    select 1 from jsonb_object_keys(_changes) as keys(key)
    where key <> all(array[
      'name','category','logo_url','brand_color','description','welcome_message',
      'phone','website','address_line1','address_line2','city','postal_code',
      'region','country','latitude','longitude'
    ])
  ) then
    raise exception 'Unsupported business field';
  end if;

  select * into v_business from public.businesses
  where id = _business_id for update;
  if not found then raise exception 'Business not found'; end if;
  if v_business.owner_id <> auth.uid() then
    raise exception 'Only the business owner can change business details';
  end if;

  if v_business.accepted_by_platform then
    select proposed_data into v_proposed
    from public.moderation_submissions
    where entity_type = 'business' and entity_id = _business_id and status = 'pending';
    v_proposed := coalesce(v_proposed, public.moderation_business_snapshot(_business_id));
    v_proposed := jsonb_set(
      v_proposed,
      '{business}',
      coalesce(v_proposed->'business', '{}'::jsonb) || _changes
    );
    if length(btrim(coalesce(v_proposed->'business'->>'name', ''))) < 2 then
      raise exception 'Business name is required';
    end if;
    return public.upsert_moderation_submission(
      'business', _business_id, _business_id, 'update', v_proposed, auth.uid()
    );
  end if;

  v_next := jsonb_populate_record(v_business, _changes);
  if length(btrim(coalesce(v_next.name, ''))) < 2 then
    raise exception 'Business name is required';
  end if;

  perform set_config('app.moderation_apply', '1', true);
  update public.businesses set
    name = v_next.name,
    category = v_next.category,
    logo_url = v_next.logo_url,
    brand_color = v_next.brand_color,
    description = v_next.description,
    welcome_message = v_next.welcome_message,
    phone = v_next.phone,
    website = v_next.website,
    address_line1 = v_next.address_line1,
    address_line2 = v_next.address_line2,
    city = v_next.city,
    postal_code = v_next.postal_code,
    region = v_next.region,
    country = v_next.country,
    latitude = v_next.latitude,
    longitude = v_next.longitude,
    updated_at = now()
  where id = _business_id;
  perform set_config('app.moderation_apply', '0', true);

  if v_business.onboarding_completed_at is not null then
    v_submission_id := public.refresh_business_moderation(_business_id, 'create', auth.uid());
  end if;
  return v_submission_id;
end;
$$;

create or replace function public.submit_business_for_moderation(_business_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business public.businesses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_business from public.businesses where id = _business_id;
  if not found then raise exception 'Business not found'; end if;
  if v_business.owner_id <> auth.uid() then raise exception 'Only the owner can submit this business'; end if;
  if v_business.accepted_by_platform then raise exception 'Business is already accepted'; end if;
  if v_business.onboarding_completed_at is null then raise exception 'Finish onboarding before submitting'; end if;
  return public.refresh_business_moderation(_business_id, 'create', auth.uid());
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
      'step_size','logo_url','rewards','grid_cols','active','terms_and_conditions'
    ])
  ) then
    raise exception 'Unsupported card field';
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
    v_proposed := jsonb_set(v_proposed, '{card}', coalesce(v_proposed->'card', '{}'::jsonb) || _changes);
    if length(btrim(coalesce(v_proposed->'card'->>'title', ''))) < 1 then raise exception 'Card title is required'; end if;
    if length(btrim(coalesce(v_proposed->'card'->>'terms_and_conditions', ''))) < 10 then raise exception 'Card terms are required'; end if;
    return public.upsert_moderation_submission(
      'card', _template_id, v_card.business_id, 'update', v_proposed, auth.uid()
    );
  end if;

  v_next := jsonb_populate_record(v_card, _changes);
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
    updated_at = now()
  where id = _template_id;
  perform set_config('app.moderation_apply', '0', true);
  return public.refresh_card_moderation(_template_id, 'create', auth.uid());
end;
$$;

create or replace function public.submit_business_locations(
  _business_id uuid,
  _locations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted boolean;
  v_onboarding_completed_at timestamptz;
  v_proposed jsonb;
  v_normalized jsonb;
  v_kind text;
begin
  if auth.uid() is null or not public.has_business_permission(_business_id, auth.uid(), 'locations.manage') then
    raise exception 'Not authorized to manage locations';
  end if;
  if jsonb_typeof(_locations) <> 'array' or jsonb_array_length(_locations) > 50 then
    raise exception 'Locations must be an array of at most 50 items';
  end if;
  if exists (select 1 from jsonb_array_elements(_locations) x where length(btrim(coalesce(x->>'name', ''))) < 2) then
    raise exception 'Every location needs a name';
  end if;

  select accepted_by_platform, onboarding_completed_at
    into v_accepted, v_onboarding_completed_at
  from public.businesses where id = _business_id for update;
  if not found then raise exception 'Business not found'; end if;

  select coalesce(jsonb_agg(
    case when nullif(x->>'id', '') is null
      then x || jsonb_build_object('id', gen_random_uuid())
      else x end
  ), '[]'::jsonb) into v_normalized
  from jsonb_array_elements(_locations) x;

  select proposed_data into v_proposed from public.moderation_submissions
  where entity_type = 'business' and entity_id = _business_id and status = 'pending';
  v_proposed := coalesce(v_proposed, public.moderation_business_snapshot(_business_id));
  v_proposed := jsonb_set(v_proposed, '{locations}', v_normalized);
  v_kind := case when v_accepted then 'update' else 'create' end;

  if not v_accepted then
    perform set_config('app.moderation_apply', '1', true);
    delete from public.business_locations where business_id = _business_id;
    insert into public.business_locations (
      id, business_id, name, address_line1, address_line2, city, region,
      postal_code, country, phone, latitude, longitude, is_primary
    )
    select (x->>'id')::uuid, _business_id, x->>'name', x->>'address_line1',
      x->>'address_line2', x->>'city', x->>'region', x->>'postal_code',
      x->>'country', x->>'phone', (x->>'latitude')::double precision,
      (x->>'longitude')::double precision, coalesce((x->>'is_primary')::boolean, false)
    from jsonb_array_elements(v_normalized) x;
    perform set_config('app.moderation_apply', '0', true);
    if v_onboarding_completed_at is null then
      return v_normalized;
    end if;
  end if;

  perform public.upsert_moderation_submission(
    'business', _business_id, _business_id, v_kind, v_proposed, auth.uid()
  );
  return v_normalized;
end;
$$;

create or replace function public.submit_business_socials(
  _business_id uuid,
  _socials jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted boolean;
  v_onboarding_completed_at timestamptz;
  v_proposed jsonb;
  v_kind text;
begin
  if auth.uid() is null or not public.has_business_permission(_business_id, auth.uid(), 'marketplace.manage') then
    raise exception 'Not authorized to manage social links';
  end if;
  if jsonb_typeof(_socials) <> 'array' or jsonb_array_length(_socials) > 20 then
    raise exception 'Social links must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(_socials) x
    where coalesce(x->>'platform', '') <> all(array[
      'instagram','facebook','tiktok','x','youtube','linkedin','snapchat','website','other'
    ]) or coalesce(x->>'url', '') !~* '^https?://'
  ) then
    raise exception 'Invalid social link';
  end if;
  if (select count(*) from jsonb_array_elements(_socials)) <>
     (select count(distinct x->>'platform') from jsonb_array_elements(_socials) x) then
    raise exception 'Duplicate social platform';
  end if;

  select accepted_by_platform, onboarding_completed_at
    into v_accepted, v_onboarding_completed_at
  from public.businesses where id = _business_id for update;
  if not found then raise exception 'Business not found'; end if;
  select proposed_data into v_proposed from public.moderation_submissions
  where entity_type = 'business' and entity_id = _business_id and status = 'pending';
  v_proposed := coalesce(v_proposed, public.moderation_business_snapshot(_business_id));
  v_proposed := jsonb_set(v_proposed, '{socials}', _socials);
  v_kind := case when v_accepted then 'update' else 'create' end;

  if not v_accepted then
    perform set_config('app.moderation_apply', '1', true);
    delete from public.business_socials where business_id = _business_id;
    insert into public.business_socials (business_id, platform, url)
    select _business_id, x->>'platform', x->>'url'
    from jsonb_array_elements(_socials) x;
    perform set_config('app.moderation_apply', '0', true);
    if v_onboarding_completed_at is null then
      return _socials;
    end if;
  end if;

  perform public.upsert_moderation_submission(
    'business', _business_id, _business_id, v_kind, v_proposed, auth.uid()
  );
  return _socials;
end;
$$;

create or replace function public.get_pending_moderation(
  _entity_type text,
  _entity_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_result jsonb;
begin
  if _entity_type = 'business' then
    v_business_id := _entity_id;
  elsif _entity_type = 'card' then
    select business_id into v_business_id from public.card_templates where id = _entity_id;
  else
    raise exception 'Invalid moderation entity';
  end if;
  if auth.uid() is null or not public.is_business_member(v_business_id, auth.uid()) then
    raise exception 'Not authorized to view moderation';
  end if;
  select jsonb_build_object(
    'id', id,
    'change_kind', change_kind,
    'status', status,
    'submitted_at', submitted_at,
    'proposed_data', proposed_data
  ) into v_result
  from public.moderation_submissions
  where entity_type = _entity_type and entity_id = _entity_id and status = 'pending';
  return v_result;
end;
$$;

/* ----------------------------------------------------------- staff review */

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

revoke all on function public.moderation_business_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.moderation_card_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.upsert_moderation_submission(text, uuid, uuid, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.refresh_business_moderation(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.refresh_card_moderation(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.review_moderation_submission(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.submit_business_changes(uuid, jsonb) from public, anon;
revoke all on function public.submit_business_for_moderation(uuid) from public, anon;
revoke all on function public.submit_card_changes(uuid, jsonb) from public, anon;
revoke all on function public.submit_business_locations(uuid, jsonb) from public, anon;
revoke all on function public.submit_business_socials(uuid, jsonb) from public, anon;
revoke all on function public.get_pending_moderation(text, uuid) from public, anon;

grant execute on function public.submit_business_changes(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_business_for_moderation(uuid) to authenticated, service_role;
grant execute on function public.submit_card_changes(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_business_locations(uuid, jsonb) to authenticated, service_role;
grant execute on function public.submit_business_socials(uuid, jsonb) to authenticated, service_role;
grant execute on function public.get_pending_moderation(text, uuid) to authenticated, service_role;
grant execute on function public.review_moderation_submission(uuid, text, uuid, text) to service_role;
