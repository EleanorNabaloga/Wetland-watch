-- Shared rate limits for the reporter app (lib/ratelimit.js). The app also
-- creates this table on first use; this file is the record of the change.
-- Safe to run more than once.
--
-- key holds a SHA-256 hash of e.g. "report:<client IP>", never the IP itself.

CREATE TABLE IF NOT EXISTS rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits         integer NOT NULL DEFAULT 1
);
