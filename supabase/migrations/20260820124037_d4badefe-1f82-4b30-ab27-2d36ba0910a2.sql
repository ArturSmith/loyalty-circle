CREATE TABLE public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (business_id, customer_id)
);

CREATE TABLE public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('business','customer')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
CREATE INDEX chat_messages_conversation_idx ON public.chat_messages(conversation_id, created_at);
CREATE INDEX conversations_customer_idx ON public.conversations(customer_id, last_message_at desc);
CREATE INDEX conversations_business_idx ON public.conversations(business_id, last_message_at desc);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    JOIN public.businesses b ON b.id = c.business_id
    WHERE c.id = _conversation_id
      AND (c.customer_id = auth.uid() OR b.owner_id = auth.uid())
  )
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated, service_role;

CREATE POLICY "Participants read conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = conversations.business_id AND b.owner_id = auth.uid()));

CREATE POLICY "Customers create own conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Participants read messages" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

CREATE POLICY "Participants send messages" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
    AND (
      (sender_role = 'customer' AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.customer_id = auth.uid()))
      OR
      (sender_role = 'business' AND EXISTS (SELECT 1 FROM public.conversations c JOIN public.businesses b ON b.id = c.business_id WHERE c.id = conversation_id AND b.owner_id = auth.uid()))
    )
  );

CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER chat_messages_touch_conversation
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;