-- Evidence signatures for the shared reports table.
-- The reporter app also adds these columns on first use (lib/db.js), so this
-- file is the record of the change and is safe to run more than once.
--
-- signature        base64 ECDSA P-256 signature made on the reporter's phone
-- signature_status 'verified' (checked by the server when the report arrived)
--                  or 'unsigned' (the phone could not sign); reports whose
--                  signature did not match are refused and never stored.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS signature text,
  ADD COLUMN IF NOT EXISTS signature_status text;
