# Sovereign Verification Handshake — F13

**version:** v0.1  
**created:** 2026-07-09  
**author:** Hermes-Prime  
**status:** DRAFT — requires F13 ratification  

---

## Problem

An agent (FORGE-000Ω or any federated agent) can produce output that *looks* governed but:
- was generated without valid authority
- ran against stale state
- self-attested its own evidence
- skipped floor checks
- used a compromised or hallucinated tool

Arif needs a way to verify: *"This output came from a legitimate governed run, not a simulated one."*

---

## Protocol

### 1. Agent produces output + receipt

When any agent produces a deliverable, it also produces a `.receipt.json` alongside it:

```json
{
  "artifact_path": "/root/A-FORGE/forgework/fusionreceipt.md",
  "sha256": "f868d4c...",
  "timestamp_utc": "2026-07-09T00:09:00Z",
  "agent_id": "hermes-prime",
  "model": "minimax-m3",
  "provider": "opencode-go",
  "session_id": "<arifOS session id>",
  "lease_id": "<forge lease id>",
  "constitutional_chain_id": "<arifOS chain id>",
  "tools_called": [
    {"tool": "web_search", "domain": "evidence", "result_hash": "..."},
    {"tool": "write_file", "domain": "execution", "result_hash": "..."}
  ],
  "floors_checked": {
    "F1_reversible": true,
    "F2_evidence_labeled": true,
    "F3_witness_present": false,
    "F11_audit_logged": true
  },
  "verdict": "DRAFT_888_HOLD",
  "sealed": false
}
```

### 2. Arif initiates verification

Arif sends a verification request to the agent:

```
VERIFY <artifact_path> <expected_sha256>
```

### 3. Agent responds with proof bundle

The agent must provide:
- **File existence + hash** — `sha256sum <path>` matches
- **Session chain** — arifOS session that governed the run
- **Tool call log** — what tools were called, in what order
- **State at T₁** — what the live system looked like when the agent ran
- **No self-attestation** — evidence came from external sources (web, files, organs), not from the agent's own prior output

### 4. Arif verifies independently

Arif runs these checks *without* trusting the agent's word:

| Check | Command | Pass criteria |
|---|---|---|
| File exists | `test -f <path>` | exit 0 |
| Hash matches | `sha256sum <path> \| cut -d' ' -f1` | matches expected |
| Receipt valid | `python3 -c "import json; json.load(open('.receipt.json'))"` | valid JSON |
| Session exists | `curl :8088/health` | arifOS alive |
| Tools ran | grep tool calls in session logs | tools match claimed list |
| No mutation | `git status <artifact_dir>` | no uncommitted changes to receipt |

### 5. Verdict

| Result | Meaning |
|---|---|
| **ALL PASS** | Output is legitimate. Proceed to arifOS judgment. |
| **HASH MISMATCH** | File was modified after agent ran. Treat as compromised. |
| **MISSING FILE** | Agent claimed to produce artifact but didn't. Hallucination or failure. |
| **NO RECEIPT** | Agent produced output without provenance. Unverifiable. |
| **SELF-ATTESTED** | Agent used its own prior output as evidence. Circular. HOLD. |
| **NO SESSION** | Agent ran outside arifOS governance. Unauthenticated. |

---

## Payload Format

### Request (Arif → Agent)

```json
{
  "action": "verify",
  "artifact": "/path/to/file",
  "expected_hash": "sha256...",
  "require_chain": true
}
```

### Response (Agent → Arif)

```json
{
  "verified": true,
  "hash_match": true,
  "file_exists": true,
  "receipt_valid": true,
  "session_active": true,
  "tools_called": ["web_search", "write_file", "terminal"],
  "self_attestation": false,
  "proof_path": "/path/to/.receipt.json"
}
```

---

## Why this matters

Right now, the gap between "agent says it did X" and "agent actually did X" is bridged by *trust in the agent's honesty*. That's circular. The verification handshake makes it possible to check *independently*:

1. Does the file exist? (filesystem check)
2. Does the hash match? (cryptographic check)
3. Was there a governing session? (arifOS check)
4. Did the tools actually run? (session log check)
5. Was evidence external? (content audit)

If all five pass, the output is legitimate. If any fail, it's DRAFT or VOID.

---

## Ratification

This spec becomes operational when Arif (F13) ratifies it with `VERIFIED` or `RATIFIED`.
Until then, it's a draft proposal.
