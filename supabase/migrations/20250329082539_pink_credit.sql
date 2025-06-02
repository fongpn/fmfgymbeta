/*
  # Add user_id column to payments table

  1. Changes
    - Add user_id column to payments table
    - Add foreign key constraint to users table
    - Add index for better query performance

  2. Security
    - No changes to RLS policies needed
*/

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE payments 
    ADD COLUMN user_id uuid REFERENCES users(id);

    -- Add index for the foreign key
    CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);

    -- Add helpful comment
    COMMENT ON COLUMN payments.user_id IS 'References the user who processed the payment';
  END IF;
END $$;