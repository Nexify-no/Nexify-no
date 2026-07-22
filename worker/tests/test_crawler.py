import unittest
from unittest.mock import patch

from penna_ingestion.crawler import RobotsCache, _fetch_with_policy
from penna_ingestion.errors import SecurityPolicyError
from penna_ingestion.network import FetchResult


class RedirectPolicyTests(unittest.TestCase):
    @patch("penna_ingestion.crawler.fetch_once")
    def test_secondary_page_does_not_fetch_cross_origin_redirect_target(self, fetch):
        fetch.return_value = FetchResult(
            url="https://example.no/page",
            status=302,
            headers={"location": "https://other.example/landing"},
            body=b"",
        )
        robots = RobotsCache()
        robots.can_fetch = lambda _value: True

        with self.assertRaises(SecurityPolicyError) as caught:
            _fetch_with_policy(
                "https://example.no/page",
                robots,
                allowed_origin="https://example.no",
            )

        self.assertEqual(caught.exception.code, "cross_origin_redirect")
        self.assertEqual(fetch.call_count, 1)

    @patch("penna_ingestion.crawler.fetch_once")
    def test_https_redirect_cannot_downgrade_to_http(self, fetch):
        fetch.return_value = FetchResult(
            url="https://example.no/",
            status=301,
            headers={"location": "http://example.no/"},
            body=b"",
        )
        robots = RobotsCache()
        robots.can_fetch = lambda _value: True

        with self.assertRaises(SecurityPolicyError) as caught:
            _fetch_with_policy("https://example.no/", robots)

        self.assertEqual(caught.exception.code, "https_downgrade_redirect")
        self.assertEqual(fetch.call_count, 1)


if __name__ == "__main__":
    unittest.main()
