-- Add LoyaltyCard fields to card_templates
-- discount_text: The main discount or offer text (e.g., "-50%", "FREE")
-- image_url: URL to the card image
-- Keep old fields for backward compatibility

ALTER TABLE public.card_templates
ADD COLUMN discount_text TEXT NOT NULL DEFAULT '-50%',
ADD COLUMN image_url TEXT;

-- Update old data if needed
UPDATE public.card_templates
SET discount_text = COALESCE(subtitle, '-50%')
WHERE discount_text = '-50%' AND subtitle IS NOT NULL;
