-- Existing accounts were linked to their invitation rows but left in the
-- "invited" state. Active membership is required by every business RLS policy,
-- so activate those already-known administrators without requiring a link click.
update public.business_members
set status = 'active',
    accepted_at = coalesce(accepted_at, now())
where role = 'admin'
  and status = 'invited'
  and user_id is not null;
