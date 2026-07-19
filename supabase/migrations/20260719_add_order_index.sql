-- Add order_index column to card_instances to track custom ordering
ALTER TABLE card_instances ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- Create an index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_card_instances_order_index ON card_instances(customer_id, order_index DESC NULLS LAST);
