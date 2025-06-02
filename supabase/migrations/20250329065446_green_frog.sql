/*
  # Create Members Table

  1. New Tables
    - `members`
      - `id` (uuid, primary key)
      - `member_id` (text, unique)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `nric` (text)
      - `type` (text) - adult or youth
      - `status` (text)
      - `photo_url` (text)
      - `expiry_date` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  nric text NOT NULL,
  type text NOT NULL CHECK (type IN ('adult', 'youth')),
  status text NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'suspended')),
  photo_url text,
  expiry_date timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read members"
  ON members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to update members"
  ON members FOR UPDATE
  TO authenticated
  USING (true);