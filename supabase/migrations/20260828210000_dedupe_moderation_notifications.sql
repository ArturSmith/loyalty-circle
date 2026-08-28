-- One moderation submission should produce at most one notification for each
-- status. Timestamps in the original dedupe key allowed an immediate refresh
-- of the same pending submission to create an identical second notification.

create or replace function public.normalize_moderation_notification_dedupe()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_submission_id text;
  v_status text;
begin
  if new.audience <> 'business' or left(new.event_type, 11) <> 'moderation_' then
    return new;
  end if;

  v_submission_id := nullif(new.metadata->>'moderation_submission_id', '');
  v_status := nullif(new.metadata->>'status', '');
  if v_submission_id is not null and v_status is not null then
    new.dedupe_key := 'moderation:' || v_submission_id || ':' || v_status;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_moderation_notification_dedupe_trg
  on public.notifications;
create trigger normalize_moderation_notification_dedupe_trg
before insert on public.notifications
for each row execute function public.normalize_moderation_notification_dedupe();

-- Keep the first copy so any existing read state remains attached to the
-- notification the user originally received. Cascading foreign keys remove
-- read-state rows that belong only to later duplicate copies.
with ranked as (
  select
    id,
    row_number() over (
      partition by metadata->>'moderation_submission_id', metadata->>'status'
      order by created_at, id
    ) as duplicate_number
  from public.notifications
  where audience = 'business'
    and left(event_type, 11) = 'moderation_'
    and nullif(metadata->>'moderation_submission_id', '') is not null
    and nullif(metadata->>'status', '') is not null
)
delete from public.notifications n
using ranked r
where n.id = r.id
  and r.duplicate_number > 1;

update public.notifications
set dedupe_key = 'moderation:'
  || (metadata->>'moderation_submission_id')
  || ':'
  || (metadata->>'status')
where audience = 'business'
  and left(event_type, 11) = 'moderation_'
  and nullif(metadata->>'moderation_submission_id', '') is not null
  and nullif(metadata->>'status', '') is not null;

revoke all on function public.normalize_moderation_notification_dedupe()
  from public, anon, authenticated;
