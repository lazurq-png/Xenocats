-- An invoice's status is 'pending' or 'paid', as the app writes it (the invoice
-- form's schema in app/lib/schemas.ts) and the overdue rule reads it. NOT VALID,
-- like 0007: the rule holds for every invoice written from now on, and existing
-- rows are not checked, so the migration applies whatever a database already
-- holds. Once none has another status,
--   ALTER TABLE invoices VALIDATE CONSTRAINT invoices_status_check;
-- makes the rule hold for them too.
ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'paid')) NOT VALID;
