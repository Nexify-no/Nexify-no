import time
import unittest

from penna_ingestion.auth import ReplayGuard, sign_request, verify_request
from penna_ingestion.errors import IngestionError


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.secret = "s" * 64
        self.body = b'{"rootUrl":"https://example.com","requestId":"00000000-0000-4000-8000-000000000000"}'
        self.now = int(time.time())
        self.timestamp = str(self.now)
        self.nonce = "abc1234567890_nonce"
        self.guard = ReplayGuard()

    def signature(self):
        return sign_request(self.secret, "POST", "/v1/crawl", self.timestamp, self.nonce, self.body)

    def test_accepts_valid_signature_once(self):
        verify_request(
            secret=self.secret,
            method="POST",
            path="/v1/crawl",
            body=self.body,
            timestamp=self.timestamp,
            nonce=self.nonce,
            signature=self.signature(),
            replay_guard=self.guard,
            now=self.now,
        )
        with self.assertRaises(IngestionError) as caught:
            verify_request(
                secret=self.secret,
                method="POST",
                path="/v1/crawl",
                body=self.body,
                timestamp=self.timestamp,
                nonce=self.nonce,
                signature=self.signature(),
                replay_guard=self.guard,
                now=self.now,
            )
        self.assertEqual(caught.exception.code, "replayed_request")

    def test_rejects_body_tampering(self):
        with self.assertRaises(IngestionError) as caught:
            verify_request(
                secret=self.secret,
                method="POST",
                path="/v1/crawl",
                body=self.body + b" ",
                timestamp=self.timestamp,
                nonce=self.nonce,
                signature=self.signature(),
                replay_guard=self.guard,
                now=self.now,
            )
        self.assertEqual(caught.exception.code, "unauthorized")

    def test_rejects_stale_request(self):
        with self.assertRaises(IngestionError) as caught:
            verify_request(
                secret=self.secret,
                method="POST",
                path="/v1/crawl",
                body=self.body,
                timestamp=str(self.now - 120),
                nonce=self.nonce,
                signature=sign_request(
                    self.secret, "POST", "/v1/crawl", str(self.now - 120), self.nonce, self.body
                ),
                replay_guard=self.guard,
                now=self.now,
            )
        self.assertEqual(caught.exception.code, "stale_request")


if __name__ == "__main__":
    unittest.main()

