ALTER TABLE public.vouchers ALTER COLUMN card_instance_id DROP NOT NULL;
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_card_instance_id_fkey;
ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_card_instance_id_fkey
  FOREIGN KEY (card_instance_id) REFERENCES public.card_instances(id) ON DELETE SET NULL;

ALTER TABLE public.vouchers ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_template_id_fkey;
ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.card_templates(id) ON DELETE SET NULL;
