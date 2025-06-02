/*
  # Create Grace Period Access Table

  1. New Tables
    - `grace_period_access`
      - `id` (uuid, primary key)
      - `member_id` (uuid, references members)
      - `check_in_time` (timestamptz)
      - `expiry_date` (timestamptz)
      - `grace_period_days` (integer)
      - `user_id` (uuid, references users)

  2. Security
    - Enable RLS
    - Add policies for access control

  3. Indexes
    - member_id for faster lookups
    - check_in_time for date range queries
*/

-- Create grace period access table
CREATE TABLE IF NOT EXISTS grace_period_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id),
  check_in_time timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz NOT NULL,
  grace_period_days integer NOT NULL,
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_grace_period_access_member_id ON grace_period_access(member_id);
CREATE INDEX IF NOT EXISTS idx_grace_period_access_check_in_time ON grace_period_access(check_in_time);

-- Enable RLS
ALTER TABLE grace_period_access ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated to read grace period access"
  ON grace_period_access FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert grace period access"
  ON grace_period_access FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE grace_period_access IS 'Records each time a member checks in during their grace period';
COMMENT ON COLUMN grace_period_access.member_id IS 'Reference to the member who checked in';
COMMENT ON COLUMN grace_period_access.check_in_time IS 'When the member checked in';
COMMENT ON COLUMN grace_period_access.expiry_date IS 'Member''s membership expiry date at the time of check-in';
COMMENT ON COLUMN grace_period_access.grace_period_days IS 'Grace period days setting at the time of check-in';
COMMENT ON COLUMN grace_period_access.user_id IS 'Reference to the user who processed the check-in';