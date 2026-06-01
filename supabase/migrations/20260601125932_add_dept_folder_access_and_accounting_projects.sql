/*
  # Add department-scoped folder access + Accounting Projects folder

  ## Summary
  Extends the portal folder system to support department-specific folders that
  are only visible to members of a given department.

  ## Changes

  ### Modified Tables
  - `portal_folders` — adds `department_access` column (text, nullable)
    - NULL means visible to everyone (existing behavior preserved)
    - A value like 'Accounting' restricts the folder to that department only

  ### New Data
  - Inserts an "Accounting Projects" folder tagged to the Accounting department
    at sort_order 10 (after the existing Company Docs folder at 0)

  ## Notes
  - Existing folders are unaffected (their department_access stays NULL)
  - RLS policies remain the same — access filtering is done at the app layer
    based on the member's department stored in session
*/

ALTER TABLE portal_folders
  ADD COLUMN IF NOT EXISTS department_access text DEFAULT NULL;

INSERT INTO portal_folders (label, sort_order, is_open, department_access)
VALUES ('Accounting Projects', 10, true, 'Accounting')
ON CONFLICT DO NOTHING;
