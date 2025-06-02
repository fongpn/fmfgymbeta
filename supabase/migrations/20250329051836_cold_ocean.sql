/*
  # Create Settings Table and Initial Data

  1. New Tables
    - `settings`
      - `key` (text, primary key)
      - `value` (jsonb)
      - `updated_at` (timestamptz)

  2. Initial Data
    - Branding settings
    - Membership settings
    - Coupon price settings

  3. Security
    - Enable RLS
    - Add policies for read/write access
*/

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
AS $$
BEGIN
  INSERT INTO settings (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = now();
END;
$$;

-- Add helpful comments
COMMENT ON TABLE settings IS 'Stores application settings including branding, membership, and coupon configurations';
COMMENT ON COLUMN settings.key IS 'Unique identifier for the setting';
COMMENT ON COLUMN settings.value IS 'JSON value containing the setting data';
COMMENT ON COLUMN settings.updated_at IS 'Timestamp of last update';
COMMENT ON FUNCTION update_settings IS 'Function to safely update or create settings';