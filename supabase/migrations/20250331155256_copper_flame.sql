/*
  # Add Payment Method Columns to Shifts Table

  1. Changes
    - Add columns for QR and bank transfer collections
    - Add columns for system totals by payment method
    - Add columns for variances by payment method
    - Remove old system_total and variance columns
    - Add helpful comments

  2. Security
    - No changes to RLS policies needed
*/

-- Add new columns for QR and bank transfer collections
ALTER TABLE shifts
  ADD COLUMN qr_collection numeric NOT NULL DEFAULT 0 CHECK (qr_collection >= 0),
  ADD COLUMN bank_transfer_collection numeric NOT NULL DEFAULT 0 CHECK (bank_transfer_collection >= 0);

-- Add new columns for system totals by payment method
ALTER TABLE shifts
  ADD COLUMN system_cash numeric NOT NULL DEFAULT 0 CHECK (system_cash >= 0),
  ADD COLUMN system_qr numeric NOT NULL DEFAULT 0 CHECK (system_qr >= 0),
  ADD COLUMN system_bank_transfer numeric NOT NULL DEFAULT 0 CHECK (system_bank_transfer >= 0);

-- Add new columns for variances by payment method
ALTER TABLE shifts
  ADD COLUMN cash_variance numeric NOT NULL DEFAULT 0,
  ADD COLUMN qr_variance numeric NOT NULL DEFAULT 0,
  ADD COLUMN bank_transfer_variance numeric NOT NULL DEFAULT 0;

-- Drop old columns
ALTER TABLE shifts
  DROP COLUMN system_total,
  DROP COLUMN variance;

-- Add helpful comments
COMMENT ON COLUMN shifts.cash_collection IS 'Cash collected at end of shift';
COMMENT ON COLUMN shifts.qr_collection IS 'QR payments collected at end of shift';
COMMENT ON COLUMN shifts.bank_transfer_collection IS 'Bank transfers collected at end of shift';
COMMENT ON COLUMN shifts.system_cash IS 'System-recorded cash total';
COMMENT ON COLUMN shifts.system_qr IS 'System-recorded QR payments total';
COMMENT ON COLUMN shifts.system_bank_transfer IS 'System-recorded bank transfers total';
COMMENT ON COLUMN shifts.cash_variance IS 'Difference between system cash total and collected cash';
COMMENT ON COLUMN shifts.qr_variance IS 'Difference between system QR total and collected QR payments';
COMMENT ON COLUMN shifts.bank_transfer_variance IS 'Difference between system bank transfer total and collected bank transfers';