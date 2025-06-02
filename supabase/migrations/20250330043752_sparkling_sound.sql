/*
  # Create End Shift Tables

  1. New Tables
    - `shifts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users) - Current user ending shift
      - `next_user_id` (uuid, references users) - Next cashier
      - `cash_collection` (numeric) - Total cash collected
      - `system_total` (numeric) - System calculated total
      - `variance` (numeric) - Difference between collected and system total
      - `ended_at` (timestamptz)

    - `shift_stock_counts`
      - `id` (uuid, primary key)
      - `shift_id` (uuid, references shifts)
      - `product_id` (uuid, references products)
      - `counted_stock` (integer)
      - `system_stock` (integer)
      - `variance` (integer)

  2. Security
    - Enable RLS
    - Add policies for access control
*/

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  next_user_id uuid NOT NULL REFERENCES users(id),
  cash_collection numeric NOT NULL CHECK (cash_collection >= 0),
  system_total numeric NOT NULL CHECK (system_total >= 0),
  variance numeric NOT NULL,
  ended_at timestamptz DEFAULT now()
);

-- Create shift_stock_counts table
CREATE TABLE IF NOT EXISTS shift_stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id),
  product_id uuid NOT NULL REFERENCES products(id),
  counted_stock integer NOT NULL,
  system_stock integer NOT NULL,
  variance integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_next_user_id ON shifts(next_user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_ended_at ON shifts(ended_at);
CREATE INDEX IF NOT EXISTS idx_shift_stock_counts_shift_id ON shift_stock_counts(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_stock_counts_product_id ON shift_stock_counts(product_id);

-- Enable RLS
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_stock_counts ENABLE ROW LEVEL SECURITY;

-- Create policies for shifts
CREATE POLICY "Allow authenticated to read shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for shift_stock_counts
CREATE POLICY "Allow authenticated to read shift stock counts"
  ON shift_stock_counts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert shift stock counts"
  ON shift_stock_counts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE shifts IS 'Records end of shift details including cash collection and next cashier';
COMMENT ON TABLE shift_stock_counts IS 'Records stock counts at the end of each shift';