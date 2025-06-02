/*
  # Create Check-ins Table

  1. New Tables
    - `check_ins`
      - `id` (uuid, primary key)
      - `member_id` (uuid, references members)
      - `check_in_time` (timestamptz)
      - `type` (text) - member or walk-in
      - `name` (text) - for walk-ins
      - `phone` (text) - for walk-ins
      - `user_id` (uuid, references users)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id),
  check_in_time timestamptz DEFAULT now(),
  type text NOT NULL CHECK (type IN ('member', 'walk-in')),
  name text,
  phone text,
  user_id uuid REFERENCES users(id)
);

-- Enable RLS
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read check-ins"
  ON check_ins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert check-ins"
  ON check_ins FOR INSERT
  TO authenticated
  WITH CHECK (true);