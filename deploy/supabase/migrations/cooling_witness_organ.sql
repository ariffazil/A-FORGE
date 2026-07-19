-- T2.3: Add witness_organ column to cooling_ledger_entries
-- Routes cooling receipts through domain organs (GEOX/WEALTH/WELL)
-- for physical grounding before ATLAS333 integration.

ALTER TABLE cooling_ledger_entries
ADD COLUMN IF NOT EXISTS witness_organ TEXT;

-- Default to the entry's own organ if not specified
UPDATE cooling_ledger_entries SET witness_organ = organ WHERE witness_organ IS NULL;

-- Index for witness organ queries
CREATE INDEX IF NOT EXISTS idx_cooling_witness_organ ON cooling_ledger_entries(witness_organ);

COMMENT ON COLUMN cooling_ledger_entries.witness_organ IS
'T2.3: Domain organ that witnessed the drift (GEOX/WEALTH/WELL) for ΔΩΨ physical grounding routing.';
