-- Allow creating card templates with 0 steps.
-- Previous constraint required between 3 and 20.

ALTER TABLE public.card_templates
  DROP CONSTRAINT IF EXISTS card_templates_total_steps_check;

ALTER TABLE public.card_templates
  ADD CONSTRAINT card_templates_total_steps_check
  CHECK (total_steps BETWEEN 0 AND 30);
