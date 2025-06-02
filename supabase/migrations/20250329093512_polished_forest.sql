/*
  # Add check_user_exists function
  
  1. New Functions
    - `check_user_exists`
      - Parameters:
        - p_email (text): The email to check
      - Returns: boolean
      - Security: SECURITY DEFINER
      - Permissions: Only authenticated users can execute
      
  2. Security
    - Function runs with SECURITY DEFINER
    - Only authenticated users can execute
*/

-- Create the check_user_exists function
CREATE OR REPLACE FUNCTION public.check_user_exists(
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

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.check_user_exists(text) FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_exists(text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.check_user_exists IS 'Checks if a user with the given email already exists';