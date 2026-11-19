-- Add phone_fingerprint and fraud hold columns to identity_vault
ALTER TABLE identity_vault ADD COLUMN IF NOT EXISTS phone_fingerprint text;
CREATE INDEX IF NOT EXISTS idx_identity_vault_fingerprint ON identity_vault(phone_fingerprint);
ALTER TABLE identity_vault ADD COLUMN IF NOT EXISTS payout_held boolean NOT NULL DEFAULT false;
ALTER TABLE identity_vault ADD COLUMN IF NOT EXISTS payout_hold_reason text;
