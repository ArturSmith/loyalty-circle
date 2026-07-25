ALTER TABLE public.card_templates
  ADD COLUMN grid_cols smallint NULL
  CHECK (grid_cols IS NULL OR (grid_cols BETWEEN 1 AND 8));