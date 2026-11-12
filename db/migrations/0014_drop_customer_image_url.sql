-- Customers' stored images are gone for good: avatars are drawn from the name
-- (app/ui/customer-avatar.tsx). Migration 0012 made the column optional while
-- deployments still wrote it; none does now (main, dev and Nightrun no longer
-- name it), so the column goes. Existing rows keep everything else.
--
-- Order: apply this to a database only once every deployment that uses it runs
-- code that never names image_url (main since pull request #31). A deployment
-- still selecting or inserting it would fail on every customer and invoice page.
ALTER TABLE customers DROP COLUMN image_url;
