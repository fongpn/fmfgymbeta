/*
  # Fix User Role Display in Active Users List
  
  1. Changes
    - Update get_active_users function to properly format role display
    - Add proper role capitalization
    - Fix role display in email string
    
  2. Security
    - Maintain SECURITY DEFINER
    - Keep existing permissions
*/

-- Drop existing function
DROP FUNCTION IF EXISTS get_active_users();

-- Create updated function
CREATE OR REPLACE FUNCTION get_active_users()
RETURNS TABLE (
  id uuid,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email || ' (' || INITCAP(u.role) || ')'  -- Properly format role with capitalization
  FROM users u
  WHERE active = true
  ORDER BY u.email;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION get_active_users() FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_active_users() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_active_users IS 'Returns all active users with properly formatted role information';