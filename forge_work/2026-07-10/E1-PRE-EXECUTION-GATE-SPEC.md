# E1 PRE-EXECUTION GATE — Architecture Spec
## Task 1: Close the Async Mutation Gap

**Status:** DRAFT — FORGE review required
**Triggered by:** 888 SOVEREIGN DIRECTIVE (JITU) 2026-07-10
**Source audit:** `/root/A-FORGE/src/interfaces/mcp/shell/forgeShell.ts` (867 lines)

---

## FINDING: The Existing Gate is Leaky

`forge_shell` (lines 291–414) ALREADY has an authority envelope gate:

```
Step 0: verifyArifOSSession(session_id)
Step 0b: GödelLock check
Step 1: ArifJudge classification
Step 2: ArifSeal audit
```

**But the readonly bypass is the leak (line 314):**

```typescript
const readonlyBypass = !session_id && isReadonlyShellCommand(command);
```

`isReadonlyShellCommand` (lines 76–87) only checks the **base command token**:

```typescript
const firstToken = trimmed.split(/\s+/)[0]?.replace(/^["'`]/, "") ?? "";
const baseCmd = firstToken.split("/").pop() ?? firstToken;
if (READONLY_SHELL_COMMANDS.has(baseCmd)) { return true; }
```

**Exploitable examples:**
- `rm -rf /root/*` — base command is `rm` — NOT in whitelist → correctly blocked
- `git push --force origin main` — base command is `git` — NOT in whitelist → correctly blocked
- `find /root -name "*.json" -exec rm {} \;` — base command is `find` → NOT in whitelist → blocked
- `mkdir` — IS in whitelist → bypasses authority check

**The actual gap is not the bypass logic. The gap is:**
1. `mkdir` in the readonly whitelist is semantically wrong — `mkdir /root/AAA` creates a directory
2. `cp` in the readonly whitelist — `cp /dev/null /root/somefile` mutates state
3. `ln` in the readonly whitelist — `ln -sf /malicious /bin/ls` is an attack vector

---

## PRE-EXECUTION GATE LOGIC REQUIREMENT

### Layer 1: Command Token + Argument Classification

```typescript
type RiskLevel = 'SAFE' | 'MUTATION' | 'IRREVERSIBLE' | 'GODEL_LOCKED';

function classifyShellCommandRisk(command: string, cwd: string): RiskLevel {
  const trimmed = command.trim();
  
  // ── HARD DENY: patterns that cannot be authorized ──
  const HARD_DENY_PATTERNS = [
    /^rm\s+-rf\s+\/(?:\s|$)/,                          // rm -rf / (root wipe)
    /^rm\s+-rf\s+\/root(?:\s|$)/,                      // rm -rf /root
    /^dd\s+/,                                            // dd with of=/dev/sdX
    /^mkfs/,                                             // filesystem destruction
    /^:()\s*:\s*;/,                                     // fork bomb
    /\bkill\s+-9\s+1\b/,                                // kill init
  ];
  
  for (const pattern of HARD_DENY_PATTERNS) {
    if (pattern.test(trimmed)) return 'GODEL_LOCKED';
  }
  
  // ── DETERMINE BASE COMMAND ──
  const tokens = trimmed.split(/\s+/);
  const baseCmd = tokens[0]?.replace(/^["'`]/, "").split("/").pop() ?? "";
  
  // ── IRREVERSIBLE commands (require SEAL envelope + explicit confirmation) ──
  const IRREVERSIBLE_COMMANDS = new Set([
    'git',           // push, push --force, merge, rebase --abort, branch -D
    'docker',         // rmi, container rm -f, system prune
    'systemctl',     // stop, disable + unit that is critical
    'ip',            // link set down
    'iptables',      // -F (flush all rules)
    'userdel',       // delete user account
    'groupdel',      // delete group
    'truncate',      // truncate -s 0 (file wipe)
    'shred',         // secure delete
  ]);
  
  if (IRREVERSIBLE_COMMANDS.has(baseCmd)) {
    const subCmd = tokens[1] ?? "";
    const IRREVERSIBLE_SUBCOMMANDS = [
      // git
      'push', 'push --force', 'force-push', 'merge', 'branch -D', 'branch -d',
      'rebase --abort', 'reset --hard', 'push-f',
      // docker
      'rmi', 'rm -f', 'rm --force', 'prune -a', 'system prune',
      // systemctl
      'stop', 'disable',
    ];
    if (IRREVERSIBLE_SUBCOMMANDS.some(sc => subCmd.startsWith(sc))) {
      return 'IRREVERSIBLE';
    }
  }
  
  // ── MUTATION commands (require EXECUTE authority envelope) ──
  const MUTATION_COMMANDS = new Set([
    'mkdir', 'rmdir', 'touch', 'rm', 'mv', 'cp', 'ln', 'unlink',
    'chmod', 'chown', 'chgrp',
    'npm', 'yarn', 'pnpm', 'pip', 'pip3', 'uv',
    'curl', 'wget',
    'ssh', 'scp', 'rsync',
    'docker',  // run, build, start (separate from rmi/rm)
    'journalctl',
    'curl', 'wget',
  ]);
  
  if (MUTATION_COMMANDS.has(baseCmd)) {
    return 'MUTATION';
  }
  
  // ── Default: SAFE (observation) ──
  return 'SAFE';
}
```

### Layer 2: Authority Mode Requirement

| Risk Level | Required Authority | Hard Block |
|---|---|---|
| `SAFE` | OBSERVE (any) | Never |
| `MUTATION` | EXECUTE | If no valid envelope |
| `IRREVERSIBLE` | SEAL + explicit ACK | If no SEAL envelope |
| `GODEL_LOCKED` | — | Always |

### Layer 3: The Pre-Execution Gate Flow

```
forge_shell(command, session_id?)
       │
       ▼
  ┌─────────────────────┐
  │ classifyShellCommandRisk│
  │  → SAFE / MUTATION /    │
  │    IRREVERSIBLE /        │
  │    GODEL_LOCKED          │
  └──────────┬──────────────┘
              │
       ┌──────┴──────┬──────────────┬─────────────┐
       ▼             ▼              ▼             ▼
    SAFE         MUTATION    IRREVERSIBLE    GODEL_LOCKED
       │             │              │              │
       ▼             ▼              ▼              ▼
   Immediate     Verify          Verify        HARD DENY
   Execute       EXECUTE          SEAL          Return error
   (no auth)     envelope          envelope      + audit log
                    │            + ACK flag       to ArifSeal
                    ▼              │
              If no valid    If SEAL valid:
              envelope →       Block until
              GATE_HOLD        ACK confirmed
              Return           by 888
              AUTHORITY_REQUIRED
```

### Layer 4: IRREVERSIBLE ACK Protocol

When `IRREVERSIBLE` is triggered:

1. **Block execution.** Do not fire the command.
2. **Return structured HOLD:**
   ```json
   {
     "status": "HOLD_IRREVERSIBLE",
     "gate": "F1_AMANAH",
     "command_classified": "IRREVERSIBLE",
     "subcommand": "git push --force",
     "reason": "This operation cannot be automatically reversed. F1 AMANAH requires sovereign ACK.",
     "required_action": "Call arif_judge() or arif_seal() with ack=true to proceed.",
     "audit_id": "<arifSeal hash>"
   }
   ```
3. **Write to ArifSeal:** Log the attempted IRREVERSIBLE command with `blocked_at` timestamp.
4. **888 reviews and either:**
   - Confirms with `arif_seal(ack=true, command_signature="<hash>")` → execution proceeds
   - Rejects → command is never executed, sealed as DENIED

### Layer 5: Mutation Without Valid Envelope

When `MUTATION` is triggered but no valid EXECUTE envelope:

```json
{
  "status": "GATE_HOLD",
  "gate": "Authority_Envelope",
  "required": "EXECUTE",
  "got": "none",
  "action": "Call arif_init() to obtain EXECUTE authority, then retry with session_id."
}
```

**This is the current behavior for non-readonly commands — it is correct.**

### Layer 6: Remove Dangerous Readonly Entries

From `READONLY_SHELL_COMMANDS` whitelist, REMOVE:
- `mkdir` → MUTATION (creates directories)
- `touch` → MUTATION (creates/modifies files)
- `ln` → MUTATION (creates symlinks, can redirect binaries)
- `cp` → MUTATION (copies files, can overwrite)
- `touch` → MUTATION

**Keep as readonly:**
- `cat`, `head`, `tail`, `less`, `more` — pure observation
- `ls`, `stat`, `file`, `tree` — listing
- `find`, `grep`, `rg`, `ag` — search
- `date`, `echo`, `env`, `pwd`, `whoami` — info
- `jq`, `yq`, `xmllint` — parsing
- `sha256sum`, `md5sum` — hashing
- `wc`, `du`, `df` — measurement

---

## GATE IMPLEMENTATION CHECKLIST

- [ ] Update `classifyShellCommandRisk` function in `forgeShell.ts`
- [ ] Add `IRREVERSIBLE_SUBCOMMANDS` map per base command
- [ ] Add `HARD_DENY_PATTERNS` array
- [ ] Remove `mkdir`, `touch`, `cp`, `ln` from `READONLY_SHELL_COMMANDS`
- [ ] Add `IRREVERSIBLE` case to `executeShell` gate flow
- [ ] Add `GODEL_LOCKED` hard block with audit log
- [ ] Wire `arifSeal` write for blocked IRREVERSIBLE attempts
- [ ] Add `ACK` parameter to `forge_shell` for IRREVERSIBLE retry
- [ ] Write test suite: classifyShellCommandRisk unit tests

---

## REMAINING STRUCTURAL GAP (Post-Fix)

Even with the pre-execution gate, a gap remains:

**OpenCode can call `forge_shell` directly via stdio with a forged session_id.**
- The `verifyArifOSSession` function checks format (`SEAL-[a-f0-9]{16}`) but cannot verify the token was actually minted by arifOS.
- A malicious OpenCode could pass `session_id: "SEAL-0000000000000000"` and the format check passes.
- **Fix:** Call arifOS `arif_verify(session_id)` endpoint — but this endpoint doesn't exist in the current arifOS MCP surface.
- **Interim mitigation:** Bounded by localhost transport (F8). Only agents on the same VPS can call A-FORGE stdio. External actors cannot.
- **Required:** Add `arif_verify` tool to arifOS MCP surface.

---

*DITEMPA BUKAN DIBERI. Spec forged 2026-07-10. HOLD for 888 review.*
