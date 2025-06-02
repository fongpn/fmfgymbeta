/*
  # Add get_settings function
  
  1. Changes
    - Create get_settings function to retrieve settings by key
    - Grant execute permission to authenticated users
    - Add helpful comments
    
  2. Security
    - Function is SECURITY DEFINER to ensure proper access control
    - Execute permission granted only to authenticated users
*/

-- Create the get_settings function
CREATE OR REPLACE FUNCTION public.get_settings(
  p_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_value jsonb;
BEGIN
  -- Get the settings value for the given key
  SELECT value INTO v_value
  FROM public.settings
  WHERE key = p_key;

  -- Return the value (will be null if key doesn't exist)
  RETURN v_value;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.get_settings(text) FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_settings(text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_settings IS 'Retrieves settings value by key from the settings table';