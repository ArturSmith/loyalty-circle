-- Read receipts are the only conversation fields app users may mutate. Keep
-- direct UPDATE closed and expose a scope-aware operation with explicit access
-- checks instead. Scope matters when one person is both a customer and a staff
-- member of the same business.

create or replace function public.mark_conversation_read(
  _conversation_id uuid,
  _scope text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select c.customer_id, c.business_id
  into v_customer_id, v_business_id
  from public.conversations c
  where c.id = _conversation_id;

  if not found then
    raise exception 'Conversation not found';
  end if;

  if _scope = 'customer' then
    if v_customer_id is distinct from auth.uid() then
      raise exception 'Conversation not found';
    end if;

    update public.conversations
    set customer_last_read_at = now()
    where id = _conversation_id;
  elsif _scope = 'business' then
    if not public.has_business_permission(v_business_id, auth.uid(), 'customers.message') then
      raise exception 'Conversation not found';
    end if;

    update public.conversations
    set business_last_read_at = now()
    where id = _conversation_id;
  else
    raise exception 'Invalid conversation scope';
  end if;
end;
$$;

revoke all on function public.mark_conversation_read(uuid, text) from public, anon;
grant execute on function public.mark_conversation_read(uuid, text) to authenticated, service_role;

-- The original one-argument function cannot distinguish which side a user is
-- reading when they happen to hold both roles. Remove it after all app callers
-- have moved to the explicit scope contract above.
drop function if exists public.mark_conversation_read(uuid);
