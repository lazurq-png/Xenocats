-- Sessions ended by signing out (auth.ts, events.signOut), by the id each login's
-- token carries. Deleting the cookie is not enough: a request already in flight when
-- the user signs out (a prefetch of a dashboard page) answers with the session
-- cookie refreshed, and the browser keeps it. A revoked id is refused on every
-- request (auth.config.ts), so such a cookie is dead. Kept until the session would
-- have expired anyway. A new table: nothing existing changes.
CREATE TABLE revoked_sessions (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX revoked_sessions_expires_at_idx ON revoked_sessions (expires_at);
