/*
  # Add Payment Breakdown Columns to Shifts Table

  1. Changes
    - Add columns for payment type breakdowns
    - Add columns for total sales
    - Add helpful comments

  2. Security
    - No changes to RLS policies needed
*/

-- Add new columns for payment breakdowns
ALTER TABLE shifts
  ADD COLUMN member_payments numeric NOT NULL DEFAULT 0 CHECK (member_payments >= 0),
  ADD COLUMN walk_in_payments numeric NOT NULL DEFAULT 0 CHECK (walk_in_payments >= 0),
  ADD COLUMN pos_sales numeric NOT NULL DEFAULT 0 CHECK (pos_sales >= 0),
  ADD COLUMN coupon_sales numeric NOT NULL DEFAULT 0 CHECK (coupon_sales >= 0),
  ADD COLUMN total_sales numeric NOT NULL DEFAULT 0 CHECK (total_sales >= 0);

-- Add helpful comments
COMMENT ON COLUMN shifts.member_payments IS 'Total member payments (registrations and renewals) during the shift';
COMMENT ON COLUMN shifts.walk_in_payments IS 'Total walk-in payments during the shift';
COMMENT ON COLUMN shifts.pos_sales IS 'Total POS sales during the shift';
COMMENT ON COLUMN shifts.coupon_sales IS 'Total coupon sales during the shift';
COMMENT ON COLUMN shifts.total_sales IS 'Total sales across all payment types during the shift'; 