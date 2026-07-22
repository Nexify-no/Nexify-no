from __future__ import annotations


class IngestionError(Exception):
    """Expected, client-safe ingestion failure."""

    def __init__(self, code: str, public_message: str, *, http_status: int = 400):
        super().__init__(public_message)
        self.code = code
        self.public_message = public_message
        self.http_status = http_status


class SecurityPolicyError(IngestionError):
    def __init__(self, code: str = "unsafe_url"):
        super().__init__(
            code,
            "Nettadressen kan ikke analyseres av sikkerhetsgrunner.",
            http_status=400,
        )

