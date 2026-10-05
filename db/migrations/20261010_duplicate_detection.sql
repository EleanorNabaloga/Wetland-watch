-- Duplicate detection for the shared Wetland Watch reports table.
--
-- Apply to the same PostgreSQL database used by wetland-nema, after
-- 20261001_shared_reporter_storage.sql:
--
--   psql "$DATABASE_URL" -f db/migrations/20261010_duplicate_detection.sql
--
-- Safe to run more than once.

BEGIN;

-- 64-bit difference hash of the photo, as 16 hex characters.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS phash text;

-- The same hash split into eight `position:byte` keys, so a large table can be
-- narrowed with a GIN index instead of scanning every hash.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS phash_chunks text[];

-- accept | group | flag | reject
--   accept  nothing similar was found
--   group   a different photo of an incident already reported nearby in time
--   flag    the picture may be a reused one, NEMA must look at it
--   reject  never stored here; the attempt is recorded in duplicate_attempts
ALTER TABLE reports ADD COLUMN IF NOT EXISTS dup_status text NOT NULL DEFAULT 'accept';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS dup_reason text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS dup_of text REFERENCES reports(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS dup_distance smallint;

-- Reports of one incident share a case. The first report of an incident is its
-- own case; a grouped report points at that one.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS case_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_dup_status_check'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_dup_status_check
      CHECK (dup_status IN ('accept', 'group', 'flag', 'reject'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_dup_distance_check'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_dup_distance_check
      CHECK (dup_distance IS NULL OR (dup_distance >= 0 AND dup_distance <= 64));
  END IF;
END $$;

-- Existing rows predate duplicate detection: every one is its own case.
UPDATE reports SET case_id = id WHERE case_id IS NULL;

CREATE INDEX IF NOT EXISTS reports_case_id_idx ON reports (case_id);
CREATE INDEX IF NOT EXISTS reports_phash_chunks_idx ON reports USING gin (phash_chunks);

-- The NEMA review queue: flagged reports and grouped incidents.
CREATE INDEX IF NOT EXISTS reports_dup_review_idx
  ON reports (received_at DESC)
  WHERE dup_status IN ('flag', 'group');

-- Every rejected attempt, whether the byte hash, the picture hash or the unique
-- index caught it. The photo itself is never kept.
CREATE TABLE IF NOT EXISTS duplicate_attempts (
  id bigserial PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  sha text,
  phash text,
  matched_report_id text REFERENCES reports(id) ON DELETE SET NULL,
  reason text,
  distance smallint,
  lat double precision,
  lng double precision,
  client_ip text
);

CREATE INDEX IF NOT EXISTS duplicate_attempts_received_idx
  ON duplicate_attempts (received_at DESC);
CREATE INDEX IF NOT EXISTS duplicate_attempts_sha_idx ON duplicate_attempts (sha);

COMMIT;

-- Notes
-- -----
-- reports_photo_hash_uidx already exists and stays the backstop against two
-- uploads of the same bytes racing each other. It now holds the SHA-256 of the
-- decoded image bytes rather than of the base64 text; rows written before this
-- migration keep the old value, which is why the perceptual hash matters for
-- them too.
--
-- `phash_chunks` is only written for new reports. Run this once after applying
-- the migration to make the chunk index useful for existing rows:
--
--   UPDATE reports
--      SET phash_chunks = ARRAY(
--            SELECT i || ':' || substr(phash, i * 2 + 1, 2)
--              FROM generate_series(0, 7) AS i
--          )
--    WHERE phash IS NOT NULL AND phash_chunks IS NULL;
