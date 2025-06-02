/*
  # Create Coupons Table

  1. New Tables
    - `coupons`
      - `id` (uuid, primary key)
      - `code` (text, unique)
      - `type` (text)
      - `price` (numeric)
      - `valid_until` (timestamptz)
      - `max_uses` (integer)
      - `uses` (integer)
      - `active` (boolean)
      - `owner_name` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  type text NOT NULL CHECK (type IN ('adult', 'youth')),
  price numeric NOT NULL CHECK (price >= 0),
  valid_until timestamptz NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  owner_name text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read coupons"
  ON coupons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to manage coupons"
  ON coupons FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));