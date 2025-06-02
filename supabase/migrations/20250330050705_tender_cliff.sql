/*
  # Add User Management Functions

  1. New Functions
    - `get_active_users`
      - Returns all active users
      - Includes role information
      - Ordered by email

  2. Security
    - Function runs with SECURITY DEFINER
    - Only authenticated users can execute
*/

-- Create function to get active users
CREATE OR REPLACE FUNCTION get_active_users()
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM users
  WHERE active = true
  ORDER BY email;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION get_active_users() FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_active_users() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_active_users IS 'Returns all active users ordered by email';