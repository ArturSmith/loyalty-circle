revoke all on public.business_members from anon;
revoke all on public.business_members from authenticated;

grant select (id, business_id, user_id, email, role, permissions, status, invited_by, invited_at, accepted_at, created_at)
  on public.business_members to authenticated;
grant insert (id, business_id, user_id, email, role, permissions, status, invited_by, invited_at, accepted_at)
  on public.business_members to authenticated;
grant update (role, permissions, status, accepted_at, user_id)
  on public.business_members to authenticated;
grant delete on public.business_members to authenticated;
grant all on public.business_members to service_role;