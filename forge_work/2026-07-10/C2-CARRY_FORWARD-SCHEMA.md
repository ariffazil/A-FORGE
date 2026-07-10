# C2 CARRY_FORWARD SCHEMA — Architecture Spec
## Task 2: Close the Ghost Prior Ingestion Gap

**Status:** DRAFT — FORGE review required
**Triggered by:** 888 SOVEREIGN DIRECTIVE (JITU) 2026-07-10

---

## FINDING: No Schema = No Integrity

`carry_forward.json` is hand-written prose. Any session can write any key with any value. The file has no:

1. **Type enforcement** — a prior session can write `"active_scars": "garbage"` and the next session ingests it as fact
2. **Category separation** — system state (drift, broken ports) mixed with human tension (frustrations, unresolved threads) without distinction
3. **Temporal metadata** — no `written_at`, `written_by`, `expires_at`, `verified_at` fields
4. **Provenance chain** — no link to the session that wrote each entry
5. **Schema validator** — no JSON Schema or Pydantic model to reject malformed writes

**Current carry_forward.json structure (2026-07-10):**
```json
{
  "generated_at": "2026-07-10T13:10:01Z",
  "session_anchor": "unknown",
  "identity_drift": "DRIFT",           // string — no type
  "next_safe_action": "...",           // string — no constraint
  "prior_session": {                   // loose object
    "file": "session-...",
    "date": "2026-07-04",
    "intent": " Close surface drift..."
  },
  "active_scars": {                    // loose array
    "count": 2,
    "directories": "2026-06-15,2026-06-30",
    "surface": [...]
  },
  "never_patterns": [...],             // loose array
  "recent_seals": [...],               // loose array
  "wake_protocol": "..."               // free string
}
```

**The F9 violation:** Any session can write `"identity_drift: "RESOLVED""` at the end of a session and reset the drift flag without actually resolving anything. The next session ingests it as fact.

---

## SCHEMA DESIGN

### Design Principles

1. **Separation:** Immutable system state (`drift`, `broken_ports`, `vault_gaps`) separated from human tension (`unresolved_threads`, `frustrations`, `open_questions`)
2. **Type rigor:** Every field has a type. Free strings are disallowed except for `wake_protocol` (human-written instruction)
3. **Provenance:** Every entry carries `session_id`, `written_by`, `written_at`
4. **Temporal bounds:** Human tension entries have `expires_at` (soft TTL). System state entries do not expire.
5. **Verification:** Entries that were verified against live state at write-time carry `verified: true` + `verified_at`
6. **Schema version:** Schema version field prevents forward-compatibility breakage

---

### JSON SCHEMA (carry_forward.schema.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://arif-fazil.com/schemas/carry-forward-v1.json",
  "title": "carry_forward",
  "description": "Cross-session state carrier for arifOS federation. Validated at each T0 ingestion.",
  "version": 1,
  "type": "object",
  "required": ["schema_version", "generated_at", "session_anchor", "system_state", "humans"],

  "additionalProperties": false,

  "properties": {

    "schema_version": {
      "type": "integer",
      "const": 1,
      "description": "Schema version. Must be 1. Reject if mismatch."
    },

    "generated_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO8601 UTC timestamp when this file was written."
    },

    "session_anchor": {
      "oneOf": [
        { "type": "string", "pattern": "^session-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]+$" },
        { "type": "string", "enum": ["unknown", "direct"] }
      ],
      "description": "Hermes session ID that wrote this file."
    },

    "system_state": {
      "type": "object",
      "description": "Immutable system state. Not human-tension. Does not expire.",
      "required": ["identity_drift"],
      "additionalProperties": false,
      "properties": {

        "identity_drift": {
          "type": "string",
          "enum": ["CLEAN", "DRIFT", "RESOLVED"],
          "description": "Identity coherence state from last session."
        },

        "drift_session": {
          "type": ["object", "null"],
          "description": "Reference to the session where drift was first flagged.",
          "required": ["session_id", "date", "lesson_file"],
          "additionalProperties": false,
          "properties": {
            "session_id": { "type": "string" },
            "date": { "type": "string", "format": "date" },
            "lesson_file": { "type": "string" }
          }
        },

        "broken_ports": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["port", "service", "since"],
            "additionalProperties": false,
            "properties": {
              "port": { "type": "integer" },
              "service": { "type": "string" },
              "since": { "type": "string", "format": "date-time" },
              "acknowledged": { "type": "boolean", "default": false }
            }
          },
          "default": []
        },

        "vault_gaps": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["seq_start", "seq_end", "acknowledged"],
            "additionalProperties": false,
            "properties": {
              "seq_start": { "type": "integer" },
              "seq_end": { "type": "integer" },
              "acknowledged": { "type": "boolean" }
            }
          },
          "default": []
        },

        "seal_chain_head": {
          "type": ["object", "null"],
          "description": "Seal chain state at session write time.",
          "required": ["seq", "epoch"],
          "additionalProperties": false,
          "properties": {
            "seq": { "type": "integer" },
            "epoch": { "type": "string", "format": "date-time" },
            "actor": { "type": "string" }
          }
        }
      }
    },

    "humans": {
      "type": "object",
      "description": "Human-relevant state. Transient. Soft TTL.",
      "additionalProperties": false,
      "properties": {

        "unresolved_threads": {
          "type": "array",
          "description": "Topics left open at end of session. Must be re-verified at T0.",
          "items": {
            "type": "object",
            "required": ["topic", "written_by", "written_at", "expires_at"],
            "additionalProperties": false,
            "properties": {
              "topic": { "type": "string", "minLength": 1, "maxLength": 500 },
              "summary": { "type": "string", "maxLength": 1000 },
              "written_by": { "type": "string" },
              "written_at": { "type": "string", "format": "date-time" },
              "expires_at": { "type": "string", "format": "date-time" },
              "verified": { "type": "boolean", "default": false },
              "verified_at": { "type": ["string", "null"], "format": "date-time" }
            }
          },
          "default": []
        },

        "open_questions": {
          "type": "array",
          "description": "Explicit questions the human asked that were not resolved.",
          "items": {
            "type": "object",
            "required": ["question", "written_by", "written_at", "expires_at"],
            "additionalProperties": false,
            "properties": {
              "question": { "type": "string", "minLength": 1, "maxLength": 1000 },
              "written_by": { "type": "string" },
              "written_at": { "type": "string", "format": "date-time" },
              "expires_at": { "type": "string", "format": "date-time" },
              "answered": { "type": "boolean", "default": false }
            }
          },
          "default": []
        },

        "never_patterns": {
          "type": "array",
          "description": "Actions that were explicitly forbidden by sovereign ruling.",
          "items": {
            "type": "object",
            "required": ["pattern", "severity", "reason", "sealed_at", "written_by", "written_at"],
            "additionalProperties": false,
            "properties": {
              "pattern": { "type": "string" },
              "severity": { "type": "string", "enum": ["VOID", "HARD", "SOFT"] },
              "reason": { "type": "string" },
              "sealed_at": { "type": "string", "format": "date-time" },
              "written_by": { "type": "string" },
              "written_at": { "type": "string", "format": "date-time" }
            }
          },
          "default": []
        }
      }
    },

    "recent_seals": {
      "type": "array",
      "description": "Last N seal chain entries. Provenance record.",
      "items": {
        "type": "object",
        "required": ["seq", "actor", "verdict"],
        "additionalProperties": false,
        "properties": {
          "seq": { "type": "integer" },
          "actor": { "type": "string" },
          "verdict": { "type": "string", "enum": ["SEAL", "HOLD", "SABAR", "VOID"] }
        }
      },
      "default": []
    },

    "wake_protocol": {
      "type": "string",
      "maxLength": 2000,
      "description": "Human-written instruction for the next session. Free string — the human's voice, not machine output."
    },

    "_provenance": {
      "type": "object",
      "description": "Schema metadata. Not user-facing.",
      "required": ["written_by", "written_at", "source_session"],
      "additionalProperties": false,
      "properties": {
        "written_by": { "type": "string" },
        "written_at": { "type": "string", "format": "date-time" },
        "source_session": { "type": "string" }
      }
    }
  }
}
```

---

## SCHEMA ENFORCEMENT RULES

### T0 Ingestion (Hermes session start)

```
1. Read carry_forward.json
2. Validate against schema (JSON Schema draft-07)
   → If invalid: REJECT, log schema violations, do NOT ingest
   → If valid: proceed
3. Check schema_version
   → If version mismatch: REJECT, alert Arif
4. Check each `humans.unresolved_threads[].expires_at`
   → If expired (now > expires_at): DROP that entry, do not carry forward
5. Check `humans.unresolved_threads[].verified`
   → If verified=false AND expires_at > now: carry at LOW CONFIDENCE
   → If verified=true: carry at NORMAL CONFIDENCE
6. Check system_state entries
   → No expiration. Always carry.
   → But verify against live state where possible (e.g., seal_chain_head seq)
```

### T_{-1} Write (End of session)

```
1. Build carry_forward.json per schema
2. Populate _provenance with session metadata
3. Set expires_at on human entries
   → unresolved_threads: 7 days from now
   → open_questions: 3 days from now
4. Validate against schema BEFORE writing
   → If invalid: REJECT write, alert Arif, DO NOT overwrite existing valid file
5. Atomic write (write to temp, rename)
```

---

## MIGRATION PATH

The current `carry_forward.json` at `/root/.local/share/arifos/carry_forward.json` is invalid against this schema (it uses loose types).

**Migration:**
1. Write a `carry_forward_migrate.py` script that reads the current file, maps to the new schema, fills missing required fields with defaults
2. Validate the migrated output
3. Overwrite with migrated version
4. From next session onward, schema validation is enforced

**Defaults for migration:**
- `schema_version`: 1
- `system_state`: inherits current top-level fields
- `humans.unresolved_threads`: current `prior_session.intent` → first entry
- `humans.open_questions`: empty
- `humans.never_patterns`: current `never_patterns` array
- `_provenance`: `written_by: "migration-script"`, `written_at: <now>`

---

## FILES TO CREATE

| File | Purpose |
|---|---|
| `/root/arifOS/schema/carry_forward.schema.json` | JSON Schema v1 |
| `/root/arifOS/validate_carry_forward.py` | Schema validator (Python, no external deps) |
| `/root/arifOS/migrate_carry_forward.py` | One-shot migration from v0 to v1 |
| `/root/A-FORGE/forge_work/2026-07-10/C2-CARRY_FORWARD-SCHEMA.md` | This spec |

---

*DITEMPA BUKAN DIBERI. Schema forged 2026-07-10. HOLD for 888 review.*
