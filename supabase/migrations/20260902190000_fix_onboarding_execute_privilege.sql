-- Restore the client RPC grant if a deployed function lost its EXECUTE ACL.
-- Keep onboarding authenticated-only; ownership and validation remain enforced
-- inside the existing SECURITY DEFINER function. No table/RLS changes or data edits.
begin;

revoke all on function public.submit_business_onboarding(uuid, jsonb, jsonb, jsonb, text, uuid)
  from public, anon;
grant execute on function public.submit_business_onboarding(uuid, jsonb, jsonb, jsonb, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';
commit;
