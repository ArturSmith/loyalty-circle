-- Used templates are immutable; pending edits are removed from public listings.
begin;

-- Only expose a yes/no answer to card managers, not customer identities.
create or replace function public.card_has_customers(_template_id uuid)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare v_business_id uuid;
begin
  select business_id into v_business_id from public.card_templates where id = _template_id;
  if auth.uid() is null or v_business_id is null
     or not public.can_on_business(v_business_id, 'cards.manage') then
    raise exception 'Not authorized to manage this card';
  end if;
  return exists (select 1 from public.card_instances where template_id = _template_id);
end;
$$;
revoke all on function public.card_has_customers(uuid) from public, anon;
grant execute on function public.card_has_customers(uuid) to authenticated, service_role;

-- A BEFORE UPDATE already holds the template row lock. SECURITY DEFINER makes
-- this independent of customers.view RLS, including moderator/service writes.
create or replace function public.guard_card_in_use()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if row(new.business_id, new.title, new.subtitle, new.description, new.corner_title,
         new.total_steps, new.shape, new.bg_color, new.accent_color, new.text_color,
         new.stamp_icon, new.stamp_shape, new.step_size, new.logo_url, new.rewards,
         new.grid_cols, new.terms_and_conditions, new.usage_instructions)
     is distinct from
     row(old.business_id, old.title, old.subtitle, old.description, old.corner_title,
         old.total_steps, old.shape, old.bg_color, old.accent_color, old.text_color,
         old.stamp_icon, old.stamp_shape, old.step_size, old.logo_url, old.rewards,
         old.grid_cols, old.terms_and_conditions, old.usage_instructions)
     and exists (select 1 from public.card_instances where template_id = old.id) then
    raise exception 'This card is already used by customers and cannot be edited. Create a new card instead.';
  end if;
  -- Operational publication/acceptance flags may still be changed by moderation.
  return new;
end;
$$;
create trigger guard_card_in_use_trg before update on public.card_templates
for each row execute function public.guard_card_in_use();

-- Serialize all instance creation paths (including anonymous issuance) with
-- edits. Recheck after acquiring the lock: an earlier RPC read may be stale.
create or replace function public.guard_card_instance_publication()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_card public.card_templates%rowtype;
begin
  if tg_op = 'UPDATE' and new.template_id = old.template_id then return new; end if;
  select * into v_card from public.card_templates where id = new.template_id for update;
  if not found or not v_card.active or not v_card.accepted_by_platform then
    raise exception 'This card is not available anymore';
  end if;
  if exists (select 1 from public.moderation_submissions
             where entity_type = 'card' and entity_id = new.template_id and status = 'pending') then
    raise exception 'This card is awaiting platform review';
  end if;
  if not exists (select 1 from public.businesses where id = v_card.business_id and accepted_by_platform) then
    raise exception 'This card is awaiting platform review';
  end if;
  if new.terms_accepted_version is not null and new.terms_accepted_version <> v_card.terms_version then
    raise exception 'The card terms changed. Please review and accept the latest version.';
  end if;
  return new;
end;
$$;
create trigger guard_card_instance_publication_trg
before insert or update of template_id on public.card_instances
for each row execute function public.guard_card_instance_publication();

revoke all on function public.guard_card_in_use() from public, anon, authenticated;
revoke all on function public.guard_card_instance_publication() from public, anon, authenticated;

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
  v_submission_id uuid;
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

  if exists (select 1 from public.card_instances where template_id = _template_id) then
    raise exception 'This card is already used by customers and cannot be edited. Create a new card instead.';
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
    v_submission_id := public.upsert_moderation_submission(
      'card', _template_id, v_card.business_id, 'update', v_proposed, auth.uid()
    );
    -- Keep intended publication state in the proposal; hide the live version
    -- atomically. Approval restores the proposal's active flag.
    perform set_config('app.moderation_apply', '1', true);
    update public.card_templates set active = false, updated_at = now() where id = _template_id;
    perform set_config('app.moderation_apply', '0', true);
    return v_submission_id;
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

revoke all on function public.submit_card_changes(uuid, jsonb) from public, anon;
grant execute on function public.submit_card_changes(uuid, jsonb) to authenticated, service_role;

-- Cover edits already waiting for review. Wallet ownership and stamped
-- progress remain untouched; all public discovery projections filter active.
select set_config('app.moderation_apply', '1', true);
update public.card_templates t set active = false, updated_at = now()
where t.accepted_by_platform and t.active and exists (
  select 1 from public.moderation_submissions m
  where m.entity_type = 'card' and m.entity_id = t.id and m.status = 'pending'
);
select set_config('app.moderation_apply', '0', true);

notify pgrst, 'reload schema';
commit;
