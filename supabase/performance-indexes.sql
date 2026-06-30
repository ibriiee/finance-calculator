-- Performance indexes — run once in Supabase SQL Editor
-- Safe to re-run (all use IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_sadaka_income_date
  ON sadaka_entries(source_income_id, date_given);

CREATE INDEX IF NOT EXISTS idx_repay_loan
  ON loan_repayments(loan_id);

CREATE INDEX IF NOT EXISTS idx_ledger_settled_date
  ON brother_ledger(is_settled, transaction_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rates_type
  ON rates_cache(rate_type);
