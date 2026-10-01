-- An invoice belongs to a customer that exists, and a customer who still has
-- invoices cannot be deleted. Written to apply to a database that already holds
-- data: it adds to the tables and changes no row. On a database with an invoice
-- whose customer is missing it fails, and changes nothing (each migration runs in
-- one transaction): such an invoice must be fixed first. It blocks writes to
-- invoices and customers while it runs: on a large live table, apply it when quiet.
ALTER TABLE invoices
  ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;

-- The invoice list joins customers on customer_id (as does the search), and
-- deleting a customer looks up their invoices by it.
CREATE INDEX invoices_customer_id_idx ON invoices (customer_id);

-- The invoice list, the latest invoices and the date ranges sort and filter by date.
CREATE INDEX invoices_date_idx ON invoices (date DESC);

-- Filtering by status, newest first.
CREATE INDEX invoices_status_date_idx ON invoices (status, date DESC);
