-- Each account has its own customers, and through them its own invoices: a
-- customer belongs to one user (its owner), an invoice to whoever owns its
-- customer. On a database that already has customers, they all go to the only
-- user there is. With customers and not exactly one user nobody can say whose
-- they are, so the migration stops, and changes nothing (it runs in one
-- transaction). A human then gives every customer an owner first:
--   ALTER TABLE customers ADD COLUMN owner_id UUID;
--   UPDATE customers SET owner_id = '<a user id>' WHERE ...;
-- and runs it again: the column is kept, and the key, the NOT NULL and the
-- index are added to it.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS owner_id UUID;

DO $$
DECLARE
  user_count INT;
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE owner_id IS NULL) THEN
    SELECT count(*) INTO user_count FROM users;
    IF user_count <> 1 THEN
      RAISE EXCEPTION 'customers without an owner, and % users: give each customer an owner (customers.owner_id) first, as db/migrations/0005_customer_owners.sql says', user_count;
    END IF;
    UPDATE customers SET owner_id = (SELECT id FROM users) WHERE owner_id IS NULL;
  END IF;
END
$$;

ALTER TABLE customers ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE customers
  ADD CONSTRAINT customers_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT;

CREATE INDEX customers_owner_id_idx ON customers (owner_id);
