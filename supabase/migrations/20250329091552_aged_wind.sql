/*
  # Add create_user function
  
  1. New Functions
    - `create_user`
      - Parameters:
        - p_id (uuid): The user's ID from auth.users
        - p_email (text): The user's email address
        - p_role (text): The user's role (cashier, admin, superadmin)
      - Returns: users record
      - Security: SECURITY DEFINER to run with owner privileges
      - Permissions: Only authenticated users can execute

  2. Security
    - Function runs with SECURITY DEFINER
    - Only authenticated users can execute the function
    - Validates role is valid before creating user
*/

-- Create the create_user function
CREATE OR REPLACE FUNCTION public.create_user(
  p_id uuid,
  p_email text,
  p_role text
)
RETURNS users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user users;
BEGIN
  -- Validate role
  IF p_role NOT IN ('cashier', 'admin', 'superadmin') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Insert new user
  INSERT INTO public.users (id, email, role)
  VALUES (p_id, p_email, p_role)
  RETURNING * INTO v_user;

  RETURN v_user;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.create_user(uuid, text, text) FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user(uuid, text, text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.create_user IS 'Creates a new user record with the specified ID, email, and role';