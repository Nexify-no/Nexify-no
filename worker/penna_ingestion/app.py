from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .auth import ReplayGuard, verify_request
from .crawler import MAX_PAGES, crawl_site
from .errors import IngestionError

MAX_REQUEST_BYTES = 16_384
REQUEST_ID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")
LOGGER = logging.getLogger("penna.ingestion")
REPLAY_GUARD = ReplayGuard()
JOB_SLOTS = threading.BoundedSemaphore(value=max(1, min(int(os.getenv("MAX_CONCURRENT_JOBS", "2")), 4)))


class PrivateServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def _json_bytes(value: dict[str, Any]) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "PennaIngestion"
    sys_version = ""

    def log_message(self, fmt: str, *args: object) -> None:
        LOGGER.info("http %s", fmt % args)

    def _headers(self, status: int, body_length: int) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(body_length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Connection", "close")
        self.end_headers()

    def _respond(self, status: int, payload: dict[str, Any]) -> None:
        body = _json_bytes(payload)
        self._headers(status, len(body))
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/healthz":
            self._respond(200, {"status": "ok"})
        else:
            self._respond(404, {"error": {"code": "not_found", "message": "Not found"}})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/crawl":
            self._respond(404, {"error": {"code": "not_found", "message": "Not found"}})
            return
        content_type = (self.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
        if content_type != "application/json":
            self._respond(415, {"error": {"code": "unsupported_media_type", "message": "JSON required"}})
            return
        raw_length = self.headers.get("content-length")
        if not raw_length or not raw_length.isdigit():
            self._respond(411, {"error": {"code": "length_required", "message": "Content-Length required"}})
            return
        length = int(raw_length)
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._respond(413, {"error": {"code": "request_too_large", "message": "Request too large"}})
            return
        self.connection.settimeout(5)
        body = self.rfile.read(length)
        if len(body) != length:
            self._respond(400, {"error": {"code": "incomplete_request", "message": "Incomplete request"}})
            return
        secret = os.getenv("PENNA_INGESTION_SECRET", "")
        request_id = "unknown"
        started = time.monotonic()
        try:
            verify_request(
                secret=secret,
                method="POST",
                path="/v1/crawl",
                body=body,
                timestamp=self.headers.get("x-penna-timestamp"),
                nonce=self.headers.get("x-penna-nonce"),
                signature=self.headers.get("x-penna-signature"),
                replay_guard=REPLAY_GUARD,
            )
            try:
                payload = json.loads(body)
            except json.JSONDecodeError as exc:
                raise IngestionError("invalid_json", "Ugyldig intern forespørsel.") from exc
            if not isinstance(payload, dict) or set(payload) - {"rootUrl", "requestId", "maxPages"}:
                raise IngestionError("invalid_request", "Ugyldig intern forespørsel.")
            root_url = payload.get("rootUrl")
            request_id = payload.get("requestId")
            max_pages = payload.get("maxPages", MAX_PAGES)
            if not isinstance(root_url, str) or not isinstance(request_id, str) or not REQUEST_ID_RE.fullmatch(request_id):
                raise IngestionError("invalid_request", "Ugyldig intern forespørsel.")
            if not isinstance(max_pages, int):
                raise IngestionError("invalid_request", "Ugyldig intern forespørsel.")
            if not JOB_SLOTS.acquire(blocking=False):
                raise IngestionError("busy", "Analysetjenesten er opptatt. Prøv igjen om litt.", http_status=429)
            try:
                result = crawl_site(root_url, max_pages=max_pages)
            finally:
                JOB_SLOTS.release()
            self._respond(200, result)
            LOGGER.info(
                "crawl complete request_id=%s pages=%d duration_ms=%d",
                request_id,
                len(result.get("pages", [])),
                int((time.monotonic() - started) * 1000),
            )
        except IngestionError as exc:
            LOGGER.warning("crawl rejected request_id=%s code=%s", request_id, exc.code)
            self._respond(exc.http_status, {"error": {"code": exc.code, "message": exc.public_message}})
        except Exception:
            LOGGER.exception("crawl failed request_id=%s", request_id)
            self._respond(500, {"error": {"code": "internal_error", "message": "Analysen mislyktes. Prøv igjen senere."}})


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    secret = os.getenv("PENNA_INGESTION_SECRET", "")
    if len(secret) < 32:
        raise SystemExit("PENNA_INGESTION_SECRET must contain at least 32 characters")
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))
    server = PrivateServer((host, port), Handler)
    LOGGER.info("private ingestion worker listening on %s:%d", host, port)
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
