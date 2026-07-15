"""
lease_engine.py — APA Lease Engine.
Part of APA v1.0 — Autonomous Protocol for Applications.

forge_lease is a capability-based, time-bounded authorization primitive.
This is the runtime enforcement layer.

Properties:
  - scope: what verbs are allowed (connector + verb list)
  - TTL: how long the lease lives (seconds)
  - actor: who is acting
  - revocable: can be killed mid-flight
  - auditable: every issuance is VAULT999-sealed

Lifecycle: REQUEST → JUDGE → ACTIVE → EXECUTED → EXPIRED
"""

import json, time, uuid, hashlib
from datetime import datetime, timezone
from pathlib import Path

LEASE_STORE = Path("/root/A-FORGE/leases/lease_store.jsonl")
RECEIPT_LOG = Path("/root/A-FORGE/leases/receipts.jsonl")

class LeaseEngine:
    def __init__(self):
        self._ensure_store()
    
    def _ensure_store(self):
        LEASE_STORE.parent.mkdir(parents=True, exist_ok=True)
        RECEIPT_LOG.parent.mkdir(parents=True, exist_ok=True)
    
    def request(self, actor_id: str, scope: dict, ttl_seconds: int = 3600) -> dict:
        """Create a lease REQUEST (pending judge approval)."""
        lease = {
            "lease_id": f"lease_{uuid.uuid4().hex[:12]}",
            "actor_id": actor_id,
            "scope": scope,          # {"connector": "email", "verbs": ["send"]}
            "ttl_seconds": ttl_seconds,
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None,      # Set on activation
            "status": "REQUESTED",
            "revoked": False,
        }
        return lease
    
    def activate(self, lease: dict, judge_verdict: str = "SEAL") -> dict:
        """Activate a lease after constitutional judgment."""
        if judge_verdict != "SEAL":
            lease["status"] = "REJECTED"
            return lease
        lease["status"] = "ACTIVE"
        lease["expires_at"] = (datetime.now(timezone.utc).timestamp() + lease["ttl_seconds"])
        self._write(lease)
        return lease
    
    def validate(self, lease_id: str, required_scope: dict) -> dict:
        """Validate a lease before executing an APA verb."""
        lease = self._find(lease_id)
        if not lease:
            return {"valid": False, "reason": "LEASE_NOT_FOUND"}
        if lease.get("revoked"):
            return {"valid": False, "reason": "LEASE_REVOKED"}
        if lease.get("status") != "ACTIVE":
            return {"valid": False, "reason": f"LEASE_{lease.get('status')}"}
        if time.time() > lease.get("expires_at", 0):
            lease["status"] = "EXPIRED"
            return {"valid": False, "reason": "LEASE_EXPIRED"}
        # Scope check
        ls = lease.get("scope", {})
        if ls.get("connector") != required_scope.get("connector"):
            return {"valid": False, "reason": "SCOPE_CONNECTOR_MISMATCH"}
        for v in required_scope.get("verbs", []):
            if v not in ls.get("verbs", []):
                return {"valid": False, "reason": f"SCOPE_VERB_MISSING:{v}"}
        return {"valid": True, "lease": lease}
    
    def revoke(self, lease_id: str) -> dict:
        """Revoke a lease mid-flight (888 override)."""
        lease = self._find(lease_id)
        if lease:
            lease["revoked"] = True
            lease["status"] = "REVOKED"
            self._write(lease)
            return {"revoked": True, "lease_id": lease_id}
        return {"revoked": False, "reason": "LEASE_NOT_FOUND"}
    
    def receipt(self, lease_id: str, verb: str, result: dict):
        """Write VAULT999-anchored execution receipt."""
        receipt = {
            "lease_id": lease_id,
            "verb": verb,
            "result_summary": str(result)[:500],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sha256": hashlib.sha256(json.dumps(result, default=str).encode()).hexdigest(),
        }
        with open(RECEIPT_LOG, "a") as f:
            f.write(json.dumps(receipt) + "\n")
        return receipt
    
    def _write(self, lease: dict):
        with open(LEASE_STORE, "a") as f:
            f.write(json.dumps(lease, default=str) + "\n")
    
    def _find(self, lease_id: str) -> dict:
        if not LEASE_STORE.exists():
            return None
        leases = []
        with open(LEASE_STORE) as f:
            for line in f:
                if line.strip():
                    leases.append(json.loads(line))
        # Return most recent entry for this lease_id
        for l in reversed(leases):
            if l.get("lease_id") == lease_id:
                return l
        return None

# Singleton
engine = LeaseEngine()
