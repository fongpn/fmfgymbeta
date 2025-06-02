/*
  # Fix Membership Plans RLS Policies

  1. Changes
    - Drop existing policies
    - Create new policies for membership_plans table
    - Add proper RLS policies for all operations
    
  2. Security
    - Enable RLS
    - Add policies for read/write access based on user role
    - Ensure admins can manage plans
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated to read membership plans" ON membership_plans;
DROP POLICY IF EXISTS "Allow admins to manage membership plans" ON membership_plans;

-- Make sure RLS is enabled
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper conditions
CREATE POLICY "Allow authenticated to read membership plans"
  ON membership_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to insert membership plans"
  ON membership_plans FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role'::text) IN ('admin', 'superadmin')
  );

CREATE POLICY "Allow admins to update membership plans"
  ON membership_plans FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) IN ('admin', 'superadmin')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role'::text) IN ('admin', 'superadmin')
  );

CREATE POLICY "Allow admins to delete membership plans"
  ON membership_plans FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role'::text) IN ('admin', 'superadmin')
  );

-- Add helpful comments
COMMENT ON TABLE membership_plans IS 'Stores membership plan configurations including pricing and duration';
COMMENT ON POLICY "Allow authenticated to read membership plans" ON membership_plans IS 'Allow all authenticated users to read membership plans';
COMMENT ON POLICY "Allow admins to insert membership plans" ON membership_plans IS 'Allow admins and superadmins to create new membership plans';
COMMENT ON POLICY "Allow admins to update membership plans" ON membership_plans IS 'Allow admins and superadmins to update existing membership plans';
COMMENT ON POLICY "Allow admins to delete membership plans" ON membership_plans IS 'Allow admins and superadmins to delete membership plans';