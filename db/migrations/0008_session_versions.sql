-- Each account's session version: a login's session carries the version the account
-- had when it signed in, and a session with an older one is signed out (auth.config.ts).
-- Changing the password raises it, so every session of the account ends. Existing
-- accounts start at 0, which is what their sessions are taken to carry.
ALTER TABLE users ADD COLUMN session_version INT NOT NULL DEFAULT 0;
