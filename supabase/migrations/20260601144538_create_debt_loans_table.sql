/*
  # Create debt_loans table

  Stores individual loan records for the Debts tab in the Accounting Projects portal.

  ## New Tables
  - `debt_loans`
    - `id` (uuid, primary key)
    - `tab_id` (uuid, FK → portal_tabs.id) — scopes record to the Debts portal tab
    - `lender` (text) — lender name e.g. "BMO", "Paccar"
    - `loan_number` (text) — internal loan/account number
    - `description` (text) — short description of collateral / purpose
    - `entity` (text) — which entity (Bros, Enterprise, WHS, SAE, Logistics, MH1, MH2, MH3, MH5)
    - `balance` (numeric) — current outstanding balance
    - `origination_date` (date)
    - `maturity_date` (date)
    - `term_months` (integer)
    - `interest_rate` (numeric) — as a decimal, e.g. 0.0361 for 3.61%
    - `monthly_payment` (numeric)
    - `beginning_balance` (numeric)
    - `loan_type` (text) — "Debt", "Capital Lease", "Lease"
    - `unit_numbers` (text) — unit/trailer numbers covered
    - `auto_pull` (boolean) — whether payment is auto-pulled
    - `notes` (text) — any extra notes
    - `sort_order` (integer) — for ordering within lender group
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - Enable RLS
  - anon + authenticated can SELECT (portal uses custom auth, not Supabase auth)
  - authenticated can INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS debt_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid REFERENCES portal_tabs(id) ON DELETE CASCADE,
  lender text NOT NULL DEFAULT '',
  loan_number text DEFAULT '',
  description text DEFAULT '',
  entity text DEFAULT '',
  balance numeric(18,2) DEFAULT 0,
  origination_date date,
  maturity_date date,
  term_months integer,
  interest_rate numeric(8,6) DEFAULT 0,
  monthly_payment numeric(18,2) DEFAULT 0,
  beginning_balance numeric(18,2) DEFAULT 0,
  loan_type text DEFAULT 'Debt',
  unit_numbers text DEFAULT '',
  auto_pull boolean DEFAULT false,
  notes text DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE debt_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read debt loans"
  ON debt_loans FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert debt loans"
  ON debt_loans FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update debt loans"
  ON debt_loans FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete debt loans"
  ON debt_loans FOR DELETE
  TO authenticated
  USING (true);
