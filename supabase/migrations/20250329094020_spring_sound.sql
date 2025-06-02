/*
  # Fix User Management Functions and Policies

  1. Changes
    - Add admin_update_user_password function
    - Fix handle_new_user trigger function
    - Add user email update policy
    - Add role sync function and trigger

  2. Security
    - Functions run with SECURITY DEFINER
    - Proper permission checks
    - Role validation
*/

-- Create admin_update_user_password function
CREATE OR REPLACE FUNCTION public.admin_update_user_password(
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
  PERFORM auth.update_user(
    user_id,
    ARRAY[new_password]::text[]
  );
END;
$$;

-- Drop and recreate handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update own email" ON public.users;

-- Create policy for email updates
CREATE POLICY "Users can update own email"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    role = (SELECT role FROM public.users WHERE id = auth.uid())
  );

-- Function to update user role in auth metadata
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update auth.users metadata when role changes
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(NEW.role)
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for role sync
DROP TRIGGER IF EXISTS sync_user_role ON public.users;
CREATE TRIGGER sync_user_role
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_role();

-- Add helpful comments
COMMENT ON FUNCTION public.admin_update_user_password IS 'Allows administrators to update user passwords';
COMMENT ON FUNCTION public.handle_new_user IS 'Creates a user record when a new auth user is created';
COMMENT ON FUNCTION public.sync_user_role IS 'Keeps auth.users metadata in sync with users table role';