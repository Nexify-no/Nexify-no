import socket
import unittest
from unittest.mock import patch

from penna_ingestion.errors import SecurityPolicyError
from penna_ingestion.network import normalize_url, resolve_public_addresses


def record(address: str, family=socket.AF_INET):
    return (family, socket.SOCK_STREAM, 6, "", (address, 443))


class NetworkPolicyTests(unittest.TestCase):
    def test_normalizes_public_https_url(self):
        self.assertEqual(normalize_url("Example.com/about#team"), "https://example.com/about")

    def test_rejects_dangerous_schemes_userinfo_and_ports(self):
        for value in (
            "file:///etc/passwd",
            "https://user:pass@example.com",
            "https://example.com:8080",
            "https://localhost/test",
            "https://127.0.0.1",
            "https://anything.nip.io",
            "https://example.com\\@127.0.0.1/",
        ):
            with self.subTest(value=value), self.assertRaises(SecurityPolicyError):
                normalized = normalize_url(value)
                if value == "https://127.0.0.1":
                    with patch("socket.getaddrinfo", return_value=[record("127.0.0.1")]):
                        resolve_public_addresses("127.0.0.1", 443)

    @patch("socket.getaddrinfo")
    def test_rejects_mixed_public_private_dns(self, lookup):
        lookup.return_value = [record("93.184.216.34"), record("10.0.0.8")]
        with self.assertRaises(SecurityPolicyError):
            resolve_public_addresses("example.test", 443)

    @patch("socket.getaddrinfo")
    def test_accepts_only_public_dns_answers(self, lookup):
        lookup.return_value = [record("93.184.216.34"), record("93.184.216.35")]
        self.assertEqual(
            resolve_public_addresses("example.test", 443),
            ["93.184.216.34", "93.184.216.35"],
        )


if __name__ == "__main__":
    unittest.main()

