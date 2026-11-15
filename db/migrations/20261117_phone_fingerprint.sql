-- Add keyed phone fingerprint for fraud detection without exposing numbers
ALTER TABLE identity_vault ADD COLUMN IF NOT EXISTS phone_fingerprint text;
CREATE INDEX IF NOT EXISTS idx_identity_vault_fingerprint ON identity_vault(phone_fingerprint);
