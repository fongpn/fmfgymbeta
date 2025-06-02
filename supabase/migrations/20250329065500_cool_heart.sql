/*
  # Create Products Table

  1. New Tables
    - `products`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `price` (numeric)
      - `photo_url` (text)
      - `stock` (integer)
      - `active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL CHECK (price >= 0),
  photo_url text,
  stock integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to manage products"
  ON products FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));