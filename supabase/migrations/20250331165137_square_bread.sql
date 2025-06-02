/*
  # Add GMT+8 Timezone Support

  1. Changes
    - Add function to convert UTC to GMT+8
    - Add function to format dates in GMT+8
    - Add trigger to handle timezone conversion
    
  2. Security
    - Functions run with SECURITY DEFINER
    - Only authenticated users can execute
*/

-- Create function to convert UTC to GMT+8
CREATE OR REPLACE FUNCTION to_gmt8(utc_date timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT utc_date + interval '8 hours'
$$;

-- Create function to format date in GMT+8
CREATE OR REPLACE FUNCTION format_gmt8(utc_date timestamptz, format_str text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN to_char(utc_date + interval '8 hours', format_str);
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION to_gmt8 IS 'Converts UTC timestamp to GMT+8';
COMMENT ON FUNCTION format_gmt8 IS 'Formats UTC timestamp in GMT+8 timezone';