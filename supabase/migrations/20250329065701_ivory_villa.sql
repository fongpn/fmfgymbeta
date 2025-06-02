/*
  # Create Payments Table
  
  1. New Tables
    - `payments`
      - `id` (uuid, primary key)
      - `member_id` (uuid, references members)
      - `amount` (numeric)
      - `type` (text)
      - `payment_method` (text)
      - `items` (jsonb)
      - `check_in_id` (uuid, references check_ins)
      - `coupon_id` (uuid)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

-- Create payments table without coupon_id foreign key initially
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id),
  amount numeric NOT NULL CHECK (amount >= 0),
  type text NOT NULL CHECK (type IN ('registration', 'renewal', 'walk-in', 'pos', 'coupon')),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'qr', 'bank_transfer')),
  items jsonb,
  check_in_id uuid REFERENCES check_ins(id),
  coupon_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add foreign key constraint for coupon_id after coupons table is created
DO $$ 
BEGIN
  -- Check if coupons table exists before adding the constraint
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons') THEN
    ALTER TABLE payments 
    ADD CONSTRAINT payments_coupon_id_fkey 
    FOREIGN KEY (coupon_id) 
    REFERENCES coupons(id);
  END IF;
END $$;