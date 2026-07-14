ALTER TABLE public.card_instances REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.card_instances;