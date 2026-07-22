from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

from .errors import IngestionError, SecurityPolicyError
from .extract import ExtractedPage, extract_page
from .network import REDIRECT_CODES, FetchResult, fetch_once, normalize_url

MAX_PAGES = 8
MAX_TOTAL_CHARS = 100_000
MAX_PAGE_BYTES = 1_500_000
MAX_ROBOTS_BYTES = 512_000
TOTAL_DEADLINE_SECONDS = 40.0
USER_AGENT_TOKEN = "PennaBrandBot"
PRIORITY_TERMS = (
    "about",
    "om-oss",
    "om_oss",
    "services",
    "tjenester",
    "products",
    "produkter",
    "pricing",
    "priser",
    "case",
    "referanser",
    "faq",
    "blog",
    "kontakt",
)


def _origin(value: str) -> str:
    parts = urlsplit(value)
    port = parts.port or (443 if parts.scheme == "https" else 80)
    default = 443 if parts.scheme == "https" else 80
    host = parts.hostname or ""
    if ":" in host:
        host = f"[{host}]"
    netloc = host if port == default else f"{host}:{port}"
    return f"{parts.scheme}://{netloc}"


def _page_key(value: str) -> str:
    parts = urlsplit(value)
    return f"{parts.scheme}://{parts.netloc}{(parts.path or '/').rstrip('/') or '/'}?{parts.query}"


def _priority(value: str) -> tuple[int, int]:
    path = urlsplit(value).path.lower()
    score = sum(1 for term in PRIORITY_TERMS if term in path)
    return (-score, len(path))


@dataclass
class RobotsCache:
    parsers: dict[str, RobotFileParser | None] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def _load(self, origin: str) -> RobotFileParser | None:
        if origin in self.parsers:
            return self.parsers[origin]
        current = f"{origin}/robots.txt"
        parser: RobotFileParser | None = None
        try:
            for _ in range(3):
                result = fetch_once(current, max_bytes=MAX_ROBOTS_BYTES, timeout_seconds=5)
                if result.status in REDIRECT_CODES:
                    location = result.headers.get("location")
                    if not location:
                        break
                    current = normalize_url(urljoin(current, location))
                    continue
                if result.status == 200 and result.content_type in {"text/plain", "text/robots.txt", ""}:
                    parser = RobotFileParser()
                    parser.set_url(current)
                    parser.parse(result.text().splitlines())
                break
        except IngestionError as exc:
            self.warnings.append(f"robots_unavailable:{exc.code}")
        self.parsers[origin] = parser
        return parser

    def can_fetch(self, value: str) -> bool:
        parser = self._load(_origin(value))
        return True if parser is None else parser.can_fetch(USER_AGENT_TOKEN, value)


def _fetch_with_policy(
    value: str,
    robots: RobotsCache,
    *,
    allowed_origin: str | None = None,
) -> FetchResult:
    current = normalize_url(value)
    for _ in range(5):
        if allowed_origin is not None and _origin(current) != allowed_origin:
            raise SecurityPolicyError("cross_origin_redirect")
        if not robots.can_fetch(current):
            raise IngestionError("robots_disallowed", "Nettstedet tillater ikke automatisk analyse av denne siden.")
        result = fetch_once(current, max_bytes=MAX_PAGE_BYTES)
        if result.status not in REDIRECT_CODES:
            return result
        location = result.headers.get("location")
        if not location:
            raise IngestionError("invalid_redirect", "Nettstedet returnerte en ugyldig videresending.")
        next_url = normalize_url(urljoin(current, location))
        if urlsplit(current).scheme == "https" and urlsplit(next_url).scheme == "http":
            raise SecurityPolicyError("https_downgrade_redirect")
        current = next_url
    raise IngestionError("too_many_redirects", "Nettstedet videresendte for mange ganger.")


def _page_record(result: FetchResult, data: ExtractedPage) -> dict[str, object]:
    return {
        "url": result.url,
        "title": data.title,
        "description": data.description,
        "text": data.text,
        "contentType": result.content_type,
        "status": result.status,
        "suspiciousPromptText": data.suspicious_prompt_text,
    }


def crawl_site(value: str, *, max_pages: int = MAX_PAGES) -> dict[str, object]:
    root = normalize_url(value)
    max_pages = max(1, min(max_pages, MAX_PAGES))
    deadline = time.monotonic() + TOTAL_DEADLINE_SECONDS
    robots = RobotsCache()
    queue = [root]
    seen: set[str] = set()
    pages: list[dict[str, object]] = []
    colors: list[str] = []
    fonts: list[str] = []
    logo_url: str | None = None
    warnings: list[str] = []
    canonical_origin: str | None = None
    total_chars = 0

    while queue and len(pages) < max_pages and total_chars < MAX_TOTAL_CHARS:
        if time.monotonic() >= deadline:
            warnings.append("crawl_deadline_reached")
            break
        requested = queue.pop(0)
        key = _page_key(requested)
        if key in seen:
            continue
        seen.add(key)
        try:
            result = _fetch_with_policy(requested, robots, allowed_origin=canonical_origin)
            if result.status < 200 or result.status >= 300:
                warnings.append(f"page_http_{result.status}")
                continue
            if result.content_type not in {"text/html", "application/xhtml+xml"}:
                warnings.append("page_not_html")
                continue
            if canonical_origin is None:
                canonical_origin = _origin(result.url)
            elif _origin(result.url) != canonical_origin:
                warnings.append("cross_origin_redirect_skipped")
                continue
            data = extract_page(result.text(), result.url)
            if len(data.text) < 80:
                warnings.append("page_has_too_little_text")
                continue

            remaining = MAX_TOTAL_CHARS - total_chars
            if len(data.text) > remaining:
                data = ExtractedPage(
                    title=data.title,
                    description=data.description,
                    text=data.text[:remaining],
                    links=data.links,
                    colors=data.colors,
                    fonts=data.fonts,
                    logo_url=data.logo_url,
                    suspicious_prompt_text=data.suspicious_prompt_text,
                )
            pages.append(_page_record(result, data))
            total_chars += len(data.text)
            for color in data.colors:
                if color not in colors:
                    colors.append(color)
            for font in data.fonts:
                if font not in fonts:
                    fonts.append(font)
            logo_url = logo_url or data.logo_url

            candidates = [
                link
                for link in data.links
                if _origin(link) == canonical_origin and _page_key(link) not in seen
            ]
            candidates.sort(key=_priority)
            for candidate in candidates[:30]:
                if candidate not in queue:
                    queue.append(candidate)
        except IngestionError as exc:
            if not pages and not queue:
                raise
            warnings.append(f"page_skipped:{exc.code}")
        except (ValueError, TypeError):
            if not pages and not queue:
                raise IngestionError("invalid_html", "Fant ikke lesbart innhold på nettstedet.")
            warnings.append("page_skipped:invalid_html")

    if not pages:
        raise IngestionError("no_readable_content", "Fant ikke lesbart innhold på nettstedet.")
    warnings.extend(robots.warnings)
    return {
        "rootUrl": pages[0]["url"],
        "pages": pages,
        "colors": colors[:8],
        "fonts": fonts[:6],
        "logoUrl": logo_url,
        "warnings": list(dict.fromkeys(warnings))[:30],
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }
