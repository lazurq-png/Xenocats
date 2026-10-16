-- Survival's endless runs, on a leaderboard of their own. An endless run is
-- recorded with run_minutes 0: it has no length for its time to be held to, so
-- only the time since it started (checked when it is finished, recordSurvivalRun)
-- bounds it. Written to apply to a database that already holds runs: existing
-- rows keep their lengths, and every one of them meets the new checks.
-- (The constraint names are the ones PostgreSQL gave 0006's checks.)

ALTER TABLE survival_runs
  DROP CONSTRAINT survival_runs_run_minutes_check,
  ADD CONSTRAINT survival_runs_run_minutes_check CHECK (run_minutes IN (0, 5, 10, 15));

ALTER TABLE survival_runs
  DROP CONSTRAINT survival_runs_check,
  ADD CONSTRAINT survival_runs_check CHECK (
    time_ms >= 0 AND (run_minutes = 0 OR time_ms <= run_minutes * 60000)
  );
