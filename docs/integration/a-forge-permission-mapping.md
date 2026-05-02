# A-FORGE Permission Mapping — Tool Scopes to Layers

This document maps tool scopes within A-FORGE to the AAA five-layer stack to ensure secure and aligned execution.

| Scope | Layer | Tag | Description |
|-------|-------|-----|-------------|
| `identity_scope` | Layer 2 | `auth.identity` | Permission to read/write agent identity or cards. |
| `audit_scope` | Layer 2 | `auth.audit` | Permission to append to VAULT999 or read session logs. |
| `federation_scope`| Layer 3 | `a2a.alignment` | Permission to route tasks across federation organs. |
| `reasoning_scope` | Layer 1 | `task.reason` | Standard tool execution within a single organ. |

## Policy Gates
Every A-FORGE tool execution must verify the requesting agent's card against its required scope.
- **L2 Security**: Deny execution if `audit_scope` is missing for seal operations.
- **L3 Alignment**: Deny cross-repo task routing if `federation_scope` is missing.
