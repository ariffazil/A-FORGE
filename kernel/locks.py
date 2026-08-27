"""Redis SET NX EX lock primitive — GAP-04b.

Additive helper for federation file/infra mutations. Does not replace
AmanahLockManager (Postgres + JSONL). Use when a short-lived, crash-safe
mutex is enough and Postgres is the wrong weight.

Rollback: delete this file. No other callers are registered at mint time.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Optional

try:
    import redis
except ImportError as exc:  # pragma: no cover
    redis = None  # type: ignore
    _IMPORT_ERR = exc
else:
    _IMPORT_ERR = None

DEFAULT_TTL_S = 60
DEFAULT_REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")


class LockError(RuntimeError):
    pass


def _client(url: Optional[str] = None):
    if redis is None:
        raise LockError(f"redis-py unavailable: {_IMPORT_ERR}")
    return redis.Redis.from_url(url or DEFAULT_REDIS_URL, decode_responses=True)


def acquire(resource_id: str, ttl_s: int = DEFAULT_TTL_S, token: Optional[str] = None) -> Optional[str]:
    """Acquire lock via SET key NX EX. Returns owner token or None."""
    if not resource_id or ttl_s <= 0:
        raise LockError("resource_id required and ttl_s must be > 0")
    token = token or uuid.uuid4().hex
    key = f"forge:lock:{resource_id}"
    ok = _client().set(key, token, nx=True, ex=int(ttl_s))
    return token if ok else None


def release(resource_id: str, token: str) -> bool:
    """Release only if we still own the token (Lua compare-and-del)."""
    key = f"forge:lock:{resource_id}"
    script = (
        "if redis.call('get', KEYS[1]) == ARGV[1] then "
        "return redis.call('del', KEYS[1]) else return 0 end"
    )
    return bool(_client().eval(script, 1, key, token))


def hold(resource_id: str, ttl_s: int = DEFAULT_TTL_S, wait_s: float = 0.0, poll_s: float = 0.1):
    """Context manager. Raises LockError if not acquired within wait_s."""

    class _Hold:
        def __enter__(self):
            deadline = time.monotonic() + max(wait_s, 0.0)
            self.token = acquire(resource_id, ttl_s=ttl_s)
            while self.token is None and time.monotonic() < deadline:
                time.sleep(poll_s)
                self.token = acquire(resource_id, ttl_s=ttl_s)
            if self.token is None:
                raise LockError(f"lock busy: {resource_id}")
            return self.token

        def __exit__(self, exc_type, exc, tb):
            if getattr(self, "token", None):
                release(resource_id, self.token)
            return False

    return _Hold()
