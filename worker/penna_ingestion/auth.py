from __future__ import annotations

import hashlib
import hmac
import re
import threading
import time
from dataclasses import dataclass, field

from .errors import IngestionError

_NONCE_RE = re.compile(r"^[A-Za-z0-9_-]{16,128}$")
_SIGNATURE_RE = re.compile(r"^sha256=([0-9a-f]{64})$")


def _canonical_message(method: str, path: str, timestamp: str, nonce: str, body: bytes) -> bytes:
    body_hash = hashlib.sha256(body).hexdigest()
    return f"{method.upper()}\n{path}\n{timestamp}\n{nonce}\n{body_hash}".encode("utf-8")


def sign_request(secret: str, method: str, path: str, timestamp: str, nonce: str, body: bytes) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        _canonical_message(method, path, timestamp, nonce, body),
        hashlib.sha256,
    ).hexdigest()
    return f"sha256={digest}"


@dataclass
class ReplayGuard:
    ttl_seconds: int = 90
    max_entries: int = 10_000
    _seen: dict[str, int] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def claim(self, nonce: str, now: int) -> bool:
        with self._lock:
            expired = [key for key, expires_at in self._seen.items() if expires_at <= now]
            for key in expired:
                self._seen.pop(key, None)
            if nonce in self._seen:
                return False
            if len(self._seen) >= self.max_entries:
                oldest = min(self._seen, key=self._seen.get)
                self._seen.pop(oldest, None)
            self._seen[nonce] = now + self.ttl_seconds
            return True


def verify_request(
    *,
    secret: str,
    method: str,
    path: str,
    body: bytes,
    timestamp: str | None,
    nonce: str | None,
    signature: str | None,
    replay_guard: ReplayGuard,
    now: int | None = None,
    clock_skew_seconds: int = 60,
) -> None:
    if len(secret) < 32:
        raise RuntimeError("PENNA_INGESTION_SECRET must contain at least 32 characters")
    if not timestamp or not timestamp.isdigit() or not nonce or not _NONCE_RE.fullmatch(nonce):
        raise IngestionError("unauthorized", "Ugyldig intern autentisering.", http_status=401)
    match = _SIGNATURE_RE.fullmatch(signature or "")
    if not match:
        raise IngestionError("unauthorized", "Ugyldig intern autentisering.", http_status=401)

    current = int(time.time()) if now is None else now
    sent_at = int(timestamp)
    if abs(current - sent_at) > clock_skew_seconds:
        raise IngestionError("stale_request", "Den interne forespørselen er utløpt.", http_status=401)

    expected = sign_request(secret, method, path, timestamp, nonce, body)
    if not hmac.compare_digest(expected, signature or ""):
        raise IngestionError("unauthorized", "Ugyldig intern autentisering.", http_status=401)
    if not replay_guard.claim(nonce, current):
        raise IngestionError("replayed_request", "Den interne forespørselen er allerede brukt.", http_status=409)

