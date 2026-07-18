-- Add LoyaltyCard fields to card_templates
-- discount_text: The main discount or offer text (e.g., "-50%", "FREE")
-- image_url: URL to the card image
-- Keep old fields for backward compatibility

ALTER TABLE public.card_templates
ADD COLUMN discount_text TEXT,
ADD COLUMN image_url TEXT;

-- Backfill discount_text from subtitle if available
UPDATE public.card_templates
SET discount_text = subtitle
WHERE subtitle IS NOT NULL AND discount_text IS NULL;
