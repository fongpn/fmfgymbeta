/*
  # Fix settings table setup
  
  1. Changes
    - Drop existing policies before creating new ones
    - Create settings table if it doesn't exist
    - Add RLS policies
    - Insert default settings
    
  2. Security
    - Enable RLS
    - Add policies for read/write access
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated to read settings" ON settings;
DROP POLICY IF EXISTS "Allow admins to manage settings" ON settings;

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated to read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to manage settings"
  ON settings FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin'));

-- Insert default settings
INSERT INTO settings (key, value)
VALUES 
  -- Branding settings
  (
    'branding',
    jsonb_build_object(
      'logo_text', 'Friendly Muscle Fitness',
      'icon_enabled', true,
      'icon_color', '#ea580c',
      'logo_url', null
    )
  ),
  -- Membership settings
  (
    'membership',
    jsonb_build_object(
      'grace_period_days', 7,
      'adult_walkin_price', 15,
      'youth_walkin_price', 12
    )
  ),
  -- Coupon price settings
  (
    'coupon_prices',
    jsonb_build_object(
      'adult', 45,
      'youth', 35,
      'max_uses', 1
    )
  )
ON CONFLICT (key) DO UPDATE
SET 
  value = EXCLUDED.value,
  updated_at = now();

-- Create function to update settings
CREATE OR REPLACE FUNCTION update_settings(
  p_key text,
  p_value jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Get the user's role from the JWT
  v_user_role := auth.jwt() ->> 'role';
  
  -- Check if user has admin privileges
  IF v_user_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only admins can update settings';
  END IF;

  -- Perform the update with RLS bypass
  INSERT INTO settings (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_settings TO authenticated;

-- Add helpful comments
COMMENT ON TABLE settings IS 'Stores application settings including branding, membership, and coupon configurations';
COMMENT ON COLUMN settings.key IS 'Unique identifier for the setting';
COMMENT ON COLUMN settings.value IS 'JSON value containing the setting data';
COMMENT ON COLUMN settings.updated_at IS 'Timestamp of last update';
COMMENT ON FUNCTION update_settings IS 'Function to safely update or create settings';

-- Drop the function if it exists to ensure clean recreation
DROP FUNCTION IF EXISTS get_settings();

-- Create function to get all settings
CREATE OR REPLACE FUNCTION get_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'branding', (SELECT value FROM settings WHERE key = 'branding'),
    'membership', (SELECT value FROM settings WHERE key = 'membership'),
    'coupon_prices', (SELECT value FROM settings WHERE key = 'coupon_prices')
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION get_settings() TO anon;

-- Add helpful comments
COMMENT ON FUNCTION get_settings() IS 'Function to get all settings at once';

-- Create function to update all settings
CREATE OR REPLACE FUNCTION update_all_settings(
  p_settings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Get the user's role from the JWT
  v_user_role := auth.jwt() ->> 'role';
  
  -- Check if user has admin privileges
  IF v_user_role NOT IN ('admin', 'superadmin') THEN
    RAISE EXCEPTION 'Only admins can update settings';
  END IF;

  -- Update branding settings
  IF p_settings->'branding' IS NOT NULL THEN
    INSERT INTO settings (key, value)
    VALUES ('branding', p_settings->'branding')
    ON CONFLICT (key) 
    DO UPDATE SET 
      value = EXCLUDED.value,
      updated_at = now();
  END IF;

  -- Update membership settings
  IF p_settings->'membership' IS NOT NULL THEN
    INSERT INTO settings (key, value)
    VALUES ('membership', p_settings->'membership')
    ON CONFLICT (key) 
    DO UPDATE SET 
      value = EXCLUDED.value,
      updated_at = now();
  END IF;

  -- Update coupon prices
  IF p_settings->'coupon_prices' IS NOT NULL THEN
    INSERT INTO settings (key, value)
    VALUES ('coupon_prices', p_settings->'coupon_prices')
    ON CONFLICT (key) 
    DO UPDATE SET 
      value = EXCLUDED.value,
      updated_at = now();
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION update_all_settings TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_settings() IS 'Function to get all settings at once';
COMMENT ON FUNCTION update_all_settings IS 'Function to update multiple settings at once';