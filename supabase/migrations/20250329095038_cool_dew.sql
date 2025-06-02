/*
  # Add Member ID Generation Function and Trigger

  1. New Functions
    - `generate_member_id`
      - Gets the next available member ID number
      - Pads the number with leading zeros
      - Returns formatted member ID string

  2. Changes
    - Add trigger to auto-generate member_id if not provided
    - Ensure sequential numbering
*/

-- Create sequence for member IDs if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS member_id_seq;

-- Function to generate next member ID
CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_id integer;
BEGIN
  -- Get next value from sequence
  SELECT nextval('member_id_seq') INTO next_id;
  
  -- Format as 6-digit number with leading zeros
  RETURN LPAD(next_id::text, 6, '0');
END;
$$;

-- Function to handle member ID generation
CREATE OR REPLACE FUNCTION handle_member_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only generate member_id if not provided
  IF NEW.member_id IS NULL OR NEW.member_id = '' THEN
    NEW.member_id := generate_member_id();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate member_id
DROP TRIGGER IF EXISTS generate_member_id_trigger ON members;
CREATE TRIGGER generate_member_id_trigger
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION handle_member_id();

-- Add helpful comments
COMMENT ON FUNCTION generate_member_id IS 'Generates the next sequential member ID';
COMMENT ON FUNCTION handle_member_id IS 'Trigger function to auto-generate member ID if not provided';