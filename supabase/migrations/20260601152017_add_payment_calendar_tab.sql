/*
  # Add Payment Calendar tab to Accounting Projects folder

  Inserts a new "Payment Calendar" tab (sort_order 3.5 → 4, shifts others up)
  into the Accounting Projects folder, positioned right after Debts.
  Uses sort_order 35 to sit between Debts (30) and Carrier Pay (40).
  Safe: only inserts if the tab does not already exist.
*/

DO $$
DECLARE
  v_folder_id uuid;
BEGIN
  SELECT id INTO v_folder_id FROM portal_folders WHERE label = 'Accounting Projects' LIMIT 1;

  IF v_folder_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM portal_tabs WHERE folder_id = v_folder_id AND label = 'Payment Calendar'
  ) THEN
    -- Shift Carrier Pay, Collections, Payroll, Unbilled Orders up by 1 to make room
    UPDATE portal_tabs SET sort_order = sort_order + 1
    WHERE folder_id = v_folder_id AND sort_order >= 4;

    INSERT INTO portal_tabs (label, icon, sort_order, folder_id)
    VALUES ('Payment Calendar', 'CalendarDays', 4, v_folder_id);
  END IF;
END $$;
