/*
  # Create Coupon Uses Table
  
  1. New Tables
    - `coupon_uses`
      - `id` (uuid, primary key)
      - `coupon_id` (uuid, references coupons)
      - `user_id` (uuid, references users)
      - `payment_id` (uuid, references payments)
      - `amount_saved` (numeric)
      - `used_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS coupon_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id),
  user_id uuid REFERENCES users(id),
  payment_id uuid REFERENCES payments(id),
  amount_saved numeric NOT NULL CHECK (amount_saved >= 0),
  used_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read coupon uses"
  ON coupon_uses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert coupon uses"
  ON coupon_uses FOR INSERT
  TO authenticated
  WITH CHECK (true);