-- Accounts made with a username and a password, a limit on sign-ups, and
-- Survival's leaderboard. Written to apply to a database that already holds data:
-- existing users keep their email (and log in with it as before) and get no
-- username; nothing else changes.

-- A username: letters, digits, '_' and '-', 3 to 20 of them. No '@', so a login
-- name is a username or an email and never both. Unique whatever its case.
ALTER TABLE users
  ADD COLUMN username TEXT,
  ADD CONSTRAINT users_username_check CHECK (username ~ '^[A-Za-z0-9_-]{3,20}$');

CREATE UNIQUE INDEX users_username_key ON users (lower(username));

-- An account made with a username needs no email; every account has one or the other.
ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ADD CONSTRAINT users_login_check CHECK (email IS NOT NULL OR username IS NOT NULL);

-- Sign-ups per client address, for the sign-up limit (app/lib/sign-up-limit.ts):
-- N a day. The address is kept only as a keyed hash.
CREATE TABLE sign_up_limits (
  client TEXT PRIMARY KEY,
  sign_ups INT NOT NULL CHECK (sign_ups >= 0),
  window_start TIMESTAMPTZ NOT NULL
);

-- Survival runs of signed-in players. A run is started by the server when the game
-- starts (so its length and its start time are the server's, not the game's say),
-- and finished once, with the name typed at its end, how long it lasted and the
-- cats it sent home. A run cannot have lasted longer than its length, nor (checked
-- when it is finished) longer than the time since it started.
CREATE TABLE survival_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  run_minutes SMALLINT NOT NULL CHECK (run_minutes IN (5, 10, 15)),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  -- Any name, not the account's: 1 to 20 characters, none of them invisible or
  -- ones that turn the text around (the app allows fewer still, LeaderboardName).
  name VARCHAR(20) CHECK (
    length(btrim(name)) > 0
    AND name !~ '[\u0001-\u001f\u007f-\u009f­؜᠎​-‏ -‮⁠-⁯﻿￹-￻]'
  ),
  time_ms INT CHECK (time_ms >= 0 AND time_ms <= run_minutes * 60000),
  sent_home INT CHECK (sent_home >= 0),
  -- Finished means all of it, at once.
  CONSTRAINT survival_runs_finished_check CHECK (
    (finished_at IS NULL) = (name IS NULL)
    AND (finished_at IS NULL) = (time_ms IS NULL)
    AND (finished_at IS NULL) = (sent_home IS NULL)
  )
);

-- One run in progress per player: starting another replaces it.
CREATE UNIQUE INDEX survival_runs_open_key ON survival_runs (user_id) WHERE finished_at IS NULL;

-- The leaderboard and the personal bests: each player's best finished run of each length.
CREATE INDEX survival_runs_board_idx
  ON survival_runs (run_minutes, user_id, time_ms DESC, sent_home DESC, finished_at)
  WHERE finished_at IS NOT NULL;
