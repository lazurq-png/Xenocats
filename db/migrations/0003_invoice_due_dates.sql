-- Every invoice has a due date: 30 days after its date (the payment term the app
-- sets when it creates one). An unpaid invoice past it is overdue; that is worked
-- out when read, never stored. Written to apply to a database that already holds
-- data: existing invoices get their date + 30, and nothing else changes.
ALTER TABLE invoices ADD COLUMN due_date DATE;

UPDATE invoices SET due_date = date + 30;

-- The default keeps an insert that names no due date (the app before this
-- migration) valid: it dates invoices today, so today + 30 is its date + 30.
ALTER TABLE invoices
  ALTER COLUMN due_date SET DEFAULT (CURRENT_DATE + 30),
  ALTER COLUMN due_date SET NOT NULL,
  ADD CONSTRAINT invoices_due_date_check CHECK (due_date >= date);
