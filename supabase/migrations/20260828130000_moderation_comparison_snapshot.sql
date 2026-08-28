-- Preserve the accepted baseline that a moderation submission is compared
-- against. Subsequent edits update proposed_data but never move this baseline.

alter table public.moderation_submissions
  add column if not exists current_data jsonb;

-- Populate submissions that were queued before this column existed.
update public.moderation_submissions s
set current_data = case s.entity_type
  when 'business' then public.moderation_business_snapshot(s.entity_id)
  when 'card' then public.moderation_card_snapshot(s.entity_id)
  else null
end
where s.status = 'pending'
  and s.change_kind = 'update'
  and s.current_data is null;

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
  v_current_data jsonb;
begin
  select id into v_id
  from public.moderation_submissions
  where entity_type = _entity_type
    and entity_id = _entity_id
    and status = 'pending'
  for update;

  if v_id is null then
    if _change_kind = 'update' then
      v_current_data := case _entity_type
        when 'business' then public.moderation_business_snapshot(_entity_id)
        when 'card' then public.moderation_card_snapshot(_entity_id)
        else null
      end;
    end if;

    insert into public.moderation_submissions (
      entity_type, entity_id, business_id, change_kind,
      current_data, proposed_data, submitted_by
    ) values (
      _entity_type, _entity_id, _business_id, _change_kind,
      v_current_data, _proposed_data, _submitted_by
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

revoke all on function public.upsert_moderation_submission(text, uuid, uuid, text, jsonb, uuid)
  from public, anon, authenticated;

