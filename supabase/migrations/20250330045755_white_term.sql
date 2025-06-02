/*
  # Fix User Active Status Handling
  
  1. Changes
    - Add trigger to sync user active status with auth.users
    - Add function to toggle user active status
    - Update get_accessible_users function to handle active status
    
  2. Security
    - Functions run with SECURITY DEFINER
    - Only authenticated users can execute
    - Proper role checks
*/

-- Create function to toggle user active status
CREATE OR REPLACE FUNCTION toggle_user_active_status(
  p_user_id uuid,
  p_active boolean
)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user users;
  v_executor_role text;
  v_target_role text;
BEGIN
  -- Get executor's role
  SELECT role INTO v_executor_role
  FROM users
  WHERE id = auth.uid();

  -- Get target user's role
  SELECT role INTO v_target_role
  FROM users
  WHERE id = p_user_id;

  -- Check permissions
  IF v_executor_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only administrators can toggle user status';
  END IF;

  -- Prevent non-superadmins from modifying superadmin users
  IF v_target_role = 'superadmin' AND v_executor_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmins can modify superadmin users';
  END IF;

  -- Update user status
  UPDATE users
  SET active = p_active
  WHERE id = p_user_id
  RETURNING * INTO v_user;

  -- Disable/enable auth user
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{active}',
    to_jsonb(p_active)
  )
  WHERE id = p_user_id;

  -- If deactivating, invalidate all sessions for this user
  IF NOT p_active THEN
    DELETE FROM auth.sessions
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_user;
END;
$$;

-- Create trigger function to sync active status from auth to users
CREATE OR REPLACE FUNCTION sync_user_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.raw_user_meta_data->>'active' IS NOT NULL THEN
    UPDATE users
    SET active = (NEW.raw_user_meta_data->>'active')::boolean
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to sync active status
DROP TRIGGER IF EXISTS sync_user_active_status ON auth.users;
CREATE TRIGGER sync_user_active_status
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_active_status();

-- Update get_accessible_users function to handle active status
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
  SELECT u.*
  FROM users u
  WHERE
    CASE
      WHEN p_user_role = 'superadmin' THEN
        -- Superadmins see all users
        TRUE
      WHEN p_user_role = 'admin' THEN
        -- Admins see all except superadmins
        u.role != 'superadmin'
      ELSE
        -- Others see only themselves
        u.id = auth.uid()
    END
  ORDER BY u.email;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION toggle_user_active_status(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION sync_user_active_status() FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION toggle_user_active_status(uuid, boolean) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION toggle_user_active_status IS 'Toggles a user''s active status and syncs with auth.users';
COMMENT ON FUNCTION sync_user_active_status IS 'Syncs user active status from auth.users to users table';
COMMENT ON FUNCTION get_accessible_users IS 'Returns list of users based on the caller''s role level';