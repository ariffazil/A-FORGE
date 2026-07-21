-- ============================================================================
-- VAULT999 Supabase Hardening Migration Script
-- ============================================================================

-- 1. Create s999.tamper_attempts logging table
CREATE TABLE IF NOT EXISTS s999.tamper_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    target_table TEXT NOT NULL,
    action_type TEXT NOT NULL,
    payload JSONB,
    actor TEXT DEFAULT current_user,
    ip_address TEXT DEFAULT inet_client_addr()::text
);

-- Ensure public can only read tamper attempts (no modifications allowed)
REVOKE INSERT, UPDATE, DELETE ON s999.tamper_attempts FROM public, authenticated, anon;
GRANT SELECT ON s999.tamper_attempts TO service_role, authenticated;

-- 2. Revoke UPDATE/DELETE on vault999_ledger
REVOKE UPDATE, DELETE ON s999.vault999_ledger FROM public, authenticated, anon;

-- 3. Trigger function to block UPDATE/DELETE and log details to s999.tamper_attempts
-- Returns OLD on UPDATE and NULL on DELETE to prevent modifications without raising
-- transaction abort exceptions, thereby preserving the tamper log record.
CREATE OR REPLACE FUNCTION s999.log_and_block_tamper()
RETURNS TRIGGER AS $$
BEGIN
    -- Perform insert bypassing restrictions because this is SECURITY DEFINER run by owner
    INSERT INTO s999.tamper_attempts (target_table, action_type, payload)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        jsonb_build_object(
            'old', CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE null END,
            'new', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE null END
        )
    );
    
    IF TG_OP = 'UPDATE' THEN
        RETURN OLD;
    ELSIF TG_OP = 'DELETE' THEN
        RETURN NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply trigger to block updates and deletes
DROP TRIGGER IF EXISTS vault999_no_update ON s999.vault999_ledger;
DROP TRIGGER IF EXISTS block_ledger_mutation ON s999.vault999_ledger;
CREATE TRIGGER block_ledger_mutation
    BEFORE UPDATE OR DELETE ON s999.vault999_ledger
    FOR EACH ROW EXECUTE FUNCTION s999.log_and_block_tamper();

-- 5. Expose SECURITY DEFINER insert interface for Merkle Roots
CREATE OR REPLACE FUNCTION public.vault_append_merkle_root(
    p_block_index INT,
    p_start_seal_id TEXT,
    p_end_seal_id TEXT,
    p_merkle_root TEXT,
    p_prev_root TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO s999.vault_merkle_roots (block_index, start_seal_id, end_seal_id, merkle_root, prev_root)
    VALUES (p_block_index, p_start_seal_id, p_end_seal_id, p_merkle_root, p_prev_root);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
