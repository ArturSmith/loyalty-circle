-- Add stamp_shape column to card_templates
ALTER TABLE card_templates ADD COLUMN IF NOT EXISTS stamp_shape TEXT DEFAULT 'circle';

-- Add check constraint to ensure valid values
ALTER TABLE card_templates ADD CONSTRAINT check_stamp_shape CHECK (stamp_shape IN ('circle', 'square', 'diamond', 'heart'));
