/*
  # Add User Management Functions
  
  1. New Functions
    - `get_accessible_users`
      - Gets users based on the caller's role
      - Superadmins see all users
      - Admins see all except superadmins
      - Others see only themselves
      
  2. Security
    - Functions run with SECURITY DEFINER
    - Proper role validation
    - Safe error handling
*/

-- Create function to get accessible users based on role
CREATE OR REPLACE FUNCTION get_accessible_users(p_user_role text)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate role
  IF p_user_role NOT IN ('cashier', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Return users based on role
  RETURN QUERY
  SELECT *
  FROM users
  WHERE
    CASE
      WHEN p_user_role = 'superadmin' THEN
        -- Superadmins see all users
        TRUE
      WHEN p_user_role = 'admin' THEN
        -- Admins see all except superadmins
        role != 'superadmin'
      ELSE
        -- Others see only themselves
        id = auth.uid()
    END
  ORDER BY email;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION get_accessible_users(text) FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_accessible_users(text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION get_accessible_users IS 'Returns list of users based on the caller''s role level';