/*
  # Create Stock Update History Table

  1. New Tables
    - `stock_history`
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `user_id` (uuid, references users)
      - `previous_stock` (integer)
      - `new_stock` (integer)
      - `change` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for access control
    - Add indexes for better query performance
*/

-- Create stock history table
CREATE TABLE IF NOT EXISTS stock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  user_id uuid REFERENCES users(id),
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL,
  change integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_history_product_id ON stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_id ON stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created_at ON stock_history(created_at);

-- Enable RLS
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated to read stock history"
  ON stock_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated to insert stock history"
  ON stock_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE stock_history IS 'Records all stock updates for products';
COMMENT ON COLUMN stock_history.product_id IS 'Reference to the product being updated';
COMMENT ON COLUMN stock_history.user_id IS 'Reference to the user who made the update';
COMMENT ON COLUMN stock_history.previous_stock IS 'Stock level before the update';
COMMENT ON COLUMN stock_history.new_stock IS 'Stock level after the update';
COMMENT ON COLUMN stock_history.change IS 'The change in stock level (positive for increase, negative for decrease)';