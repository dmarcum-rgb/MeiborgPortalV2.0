/*
  # Create loan_payment_date_overrides table

  Stores per-payment date overrides for loans. When a user edits a payment date
  in the amortization schedule, the override is saved here and applied when
  rendering both the schedule and the payment calendar.

  1. New Tables
    - `loan_payment_date_overrides`
      - `id` (uuid, primary key)
      - `loan_id` (uuid, FK → debt_loans.id)
      - `loan_number` (text) — GL # for quick lookup
      - `payment_number` (int) — which payment row (1-based) this applies to
      - `override_date` (date) — the new payment date
      - `recurring` (boolean) — if true, all subsequent payments shift by the
         same day-of-month difference
      - `created_at` / `updated_at` (timestamps)

  2. Security
    - Enable RLS
    - Anon users can read and write (same pattern as ar_reports / ap_reports)

  3. Unique constraint: one override per (loan_id, payment_number)
*/

CREATE TABLE IF NOT EXISTS loan_payment_date_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL,
  loan_number text NOT NULL DEFAULT '',
  payment_number int NOT NULL,
  override_date date NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (loan_id, payment_number)
);

ALTER TABLE loan_payment_date_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read loan payment overrides"
  ON loan_payment_date_overrides FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert loan payment overrides"
  ON loan_payment_date_overrides FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update loan payment overrides"
  ON loan_payment_date_overrides FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete loan payment overrides"
  ON loan_payment_date_overrides FOR DELETE
  TO anon
  USING (true);
