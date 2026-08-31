-- Customer conversations are a one-way channel from a business to its
-- customer. Customers may read and acknowledge messages, but only business
-- staff with the messaging permission may create them.

drop policy if exists "Participants send messages" on public.chat_messages;
drop policy if exists "Business staff send customer messages" on public.chat_messages;

create policy "Business staff send customer messages"
on public.chat_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and sender_role = 'business'
  and exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and public.has_business_permission(c.business_id, auth.uid(), 'customers.message')
  )
);
