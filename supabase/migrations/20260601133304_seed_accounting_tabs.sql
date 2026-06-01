/*
  # Seed Accounting Project tabs

  Creates tabs inside the Accounting Projects folder for all the
  accounting-specific sections shown in the MeiSolutions app.
*/

INSERT INTO portal_tabs (label, icon, sort_order, folder_id)
SELECT label, icon, sort_order, '1ce9e261-38b5-45d5-b8a9-d31a1920b601'
FROM (VALUES
  ('Accounts Receivable', 'FileText', 1),
  ('Accounts Payable',    'FileText', 2),
  ('Debts',               'AlertCircle', 3),
  ('Carrier Pay',         'Briefcase', 4),
  ('Collections',         'Users', 5),
  ('Payroll',             'Calendar', 6),
  ('Unbilled Orders',     'BookOpen', 7)
) AS t(label, icon, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM portal_tabs WHERE folder_id = '1ce9e261-38b5-45d5-b8a9-d31a1920b601'
);
