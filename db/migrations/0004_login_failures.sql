-- Failed logins per email, for the login lockout (app/lib/login-limit.ts):
-- after N failures in a row an email is refused until locked_until. Keyed by
-- the email as typed, trimmed and lower-cased, whether or not a user has it,
-- so a lockout says nothing about which emails exist. A new table: nothing
-- existing changes.
CREATE TABLE login_failures (
  email TEXT PRIMARY KEY,
  -- Attempts since the last success or since a lock ran out (counted before the
  -- password is compared, and during a lock too).
  failures INT NOT NULL CHECK (failures >= 0),
  locked_until TIMESTAMPTZ
);
