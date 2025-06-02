/*
  # Fix coupon_uses table and add missing columns
  
  1. Changes
    - Add missing columns to coupon_uses table
    - Add proper foreign key constraints
    - Add indexes for better performance
    - Add RLS policies
    
  2. Security
    - Enable RLS
    - Add policies for access control
*/

-- Drop existing table if it exists
DROP TABLE IF EXISTS coupon_uses CASCADE;

-- Create coupon_uses table with all required columns
CREATE TABLE IF NOT EXISTS coupon_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id),
  user_id uuid REFERENCES users(id),
  payment_id uuid REFERENCES payments(id),
  amount_saved numeric NOT NULL,
  used_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon_id ON coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user_id ON coupon_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_payment_id ON coupon_uses(payment_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_used_at ON coupon_uses(used_at);

-- Add constraint for amount_saved
ALTER TABLE coupon_uses 
ADD CONSTRAINT coupon_uses_amount_saved_check 
CHECK (amount_saved >= 0);

-- Enable RLS
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated to read coupon uses" ON coupon_uses;
DROP POLICY IF EXISTS "Allow authenticated to insert coupon uses" ON coupon_uses;

-- Create policies
CREATE POLICY "Allow authenticated to read coupon uses"
  ON coupon_uses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert coupon uses"
  ON coupon_uses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE coupon_uses IS 'Records each time a coupon is used';
COMMENT ON COLUMN coupon_uses.coupon_id IS 'Reference to the coupon being used';
COMMENT ON COLUMN coupon_uses.user_id IS 'Reference to the user who processed the coupon use';
COMMENT ON COLUMN coupon_uses.payment_id IS 'Reference to the payment associated with this coupon use';
COMMENT ON COLUMN coupon_uses.amount_saved IS 'The amount saved by using this coupon';
COMMENT ON COLUMN coupon_uses.used_at IS 'Timestamp when the coupon was used';