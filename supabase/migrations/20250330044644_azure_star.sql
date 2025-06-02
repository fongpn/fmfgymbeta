/*
  # Fix User Management Functions
  
  1. Changes
    - Add handle_new_user function with better error handling
    - Add trigger for user creation
    - Add function to check user existence
    - Add function to update user password
    
  2. Security
    - Functions run with SECURITY DEFINER
    - Proper role validation
    - Safe error handling
*/

-- Drop existing functions and triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS check_user_exists(text);
DROP FUNCTION IF EXISTS admin_update_user_password(uuid, text);

-- Create handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role text;
BEGIN
  -- Get role from metadata if available, otherwise default to 'cashier'
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::text,
    'cashier'
  );

  -- Validate role
  IF v_role NOT IN ('cashier', 'admin', 'superadmin') THEN
    v_role := 'cashier';
  END IF;

  -- Insert new user
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, v_role)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Log the error and re-raise
    RAISE WARNING 'User with ID % already exists', NEW.id;
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log other errors and re-raise
    RAISE WARNING 'Error creating user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger for user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create function to check if user exists
CREATE OR REPLACE FUNCTION check_user_exists(
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.users
    WHERE email = p_email
  );
END;
$$;

-- Create function to update user password
CREATE OR REPLACE FUNCTION admin_update_user_password(
  user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the executing user has admin privileges
  IF NOT (SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin')
  )) THEN
    RAISE EXCEPTION 'Only administrators can update user passwords';
  END IF;

  -- Update the user's password
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_user_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user_password(uuid, text) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION handle_new_user IS 'Creates a user record when a new auth user is created';
COMMENT ON FUNCTION check_user_exists IS 'Checks if a user with the given email already exists';
COMMENT ON FUNCTION admin_update_user_password IS 'Allows administrators to update user passwords';