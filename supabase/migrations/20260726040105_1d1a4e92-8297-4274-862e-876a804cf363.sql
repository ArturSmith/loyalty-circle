REVOKE INSERT, UPDATE, DELETE ON public.card_templates FROM anon;
GRANT SELECT ON public.card_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_templates TO authenticated;
GRANT ALL ON public.card_templates TO service_role;