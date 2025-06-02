/*
  # Create Membership History Table
  
  1. New Tables
    - `membership_history`
      - `id` (uuid, primary key)
      - `member_id` (uuid, references members)
      - `payment_id` (uuid, references payments)
      - `previous_expiry_date` (timestamptz)
      - `new_expiry_date` (timestamptz)
      - `type` (text)
      - `plan_details` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

CREATE TABLE IF NOT EXISTS membership_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id),
  payment_id uuid REFERENCES payments(id),
  previous_expiry_date timestamptz,
  new_expiry_date timestamptz NOT NULL,
  type text NOT NULL CHECK (type IN ('registration', 'renewal')),
  plan_details jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE membership_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated to read membership history"
  ON membership_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert membership history"
  ON membership_history FOR INSERT
  TO authenticated
  WITH CHECK (true);