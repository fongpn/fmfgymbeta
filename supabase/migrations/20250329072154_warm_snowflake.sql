/*
  # Create Membership Plans Table

  1. New Tables
    - `membership_plans`
      - `id` (uuid, primary key)
      - `type` (text) - adult or youth
      - `months` (integer)
      - `price` (numeric)
      - `registration_fee` (numeric)
      - `free_months` (integer)
      - `active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control

  3. Initial Data
    - Insert default membership plans
*/

-- Create membership plans table
CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('adult', 'youth')),
  months integer NOT NULL CHECK (months > 0),
  price numeric NOT NULL CHECK (price >= 0),
  registration_fee numeric NOT NULL CHECK (registration_fee >= 0),
  free_months integer NOT NULL DEFAULT 0 CHECK (free_months >= 0),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read membership plans"
  ON membership_plans FOR SELECT
  TO authenticated
  USING (true);

-- Drop and recreate the admin policy for clarity and strictness
DROP POLICY IF EXISTS "Allow admins to manage membership plans" ON membership_plans;

CREATE POLICY "Allow admins to manage membership plans"
  ON membership_plans FOR ALL
  TO authenticated
  USING (
    auth.jwt() IS NOT NULL AND auth.jwt() ->> 'role' IN ('admin', 'superadmin')
  );

-- Insert default membership plans
INSERT INTO membership_plans 
  (type, months, price, registration_fee, free_months, active)
VALUES
  -- Adult plans
  ('adult', 1, 50.00, 10.00, 0, true),
  ('adult', 3, 140.00, 10.00, 0, true),
  ('adult', 6, 270.00, 10.00, 1, true),
  ('adult', 12, 500.00, 10.00, 2, true),
  
  -- Youth plans
  ('youth', 1, 40.00, 10.00, 0, true),
  ('youth', 3, 110.00, 10.00, 0, true),
  ('youth', 6, 210.00, 10.00, 1, true),
  ('youth', 12, 400.00, 10.00, 2, true);

-- Add helpful comments
COMMENT ON TABLE membership_plans IS 'Stores membership plan configurations including pricing and duration';
COMMENT ON COLUMN membership_plans.type IS 'Type of membership (adult or youth)';
COMMENT ON COLUMN membership_plans.months IS 'Duration of the membership plan in months';
COMMENT ON COLUMN membership_plans.price IS 'Price of the membership plan';
COMMENT ON COLUMN membership_plans.registration_fee IS 'One-time registration fee for new members';
COMMENT ON COLUMN membership_plans.free_months IS 'Number of additional free months included with the plan';
COMMENT ON COLUMN membership_plans.active IS 'Whether the plan is currently available for purchase';