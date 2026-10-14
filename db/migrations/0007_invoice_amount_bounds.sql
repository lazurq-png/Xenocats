-- An invoice's amount, in cents, is at least one cent and at most $1,000,000 (the
-- app checks the same, MAX_AMOUNT in app/lib/schemas.ts). NOT VALID: the rule holds
-- for every invoice written from now on, and existing rows are not checked, so the
-- migration applies whatever a database already holds. Once none is out of bounds,
--   ALTER TABLE invoices VALIDATE CONSTRAINT invoices_amount_check;
-- makes the rule hold for them too.
ALTER TABLE invoices
  ADD CONSTRAINT invoices_amount_check CHECK (amount >= 1 AND amount <= 100000000) NOT VALID;
