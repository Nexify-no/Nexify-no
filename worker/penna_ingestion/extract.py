from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

from lxml import etree, html

TRACKING_PARAMS = {"fbclid", "gclid", "msclkid", "ref", "source"}
BLOCKED_PATH = re.compile(r"/(?:login|logg-inn|sign-in|admin|checkout|cart|konto)(?:/|$)", re.I)
BLOCKED_EXT = re.compile(r"\.(?:jpg|jpeg|png|gif|webp|svg|ico|zip|rar|7z|mp4|mp3|woff2?|ttf|eot)$", re.I)
HEX_COLOR_RE = re.compile(r"(?<![\w-])#[0-9a-fA-F]{6}\b")
FONT_RE = re.compile(r"font-family\s*:\s*([^;}]+)", re.I)
PROMPT_PATTERN = re.compile(
    r"(?:ignore|disregard|forget|ignorer|glem|se\s+bort\s+fra).{0,30}"
    r"(?:previous|above|system|tidligere|ovenfor).{0,20}(?:instruction|prompt|instruksjon)|"
    r"(?:system|developer|assistant|utvikler)\s*"
    r"(?:message|prompt|instruction|melding|instruksjon)\s*:|"
    r"(?:do\s+not\s+follow|ikke\s+følg).{0,30}(?:instruction|rule|instruksjon|regel)",
    re.I | re.S,
)


@dataclass(frozen=True)
class ExtractedPage:
    title: str
    description: str
    text: str
    links: list[str]
    colors: list[str]
    fonts: list[str]
    logo_url: str | None
    suspicious_prompt_text: bool


def _clean(value: str, limit: int) -> str:
    return " ".join((value or "").replace("\x00", " ").split())[:limit]


def _same_origin(left: str, right: str) -> bool:
    a, b = urlsplit(left), urlsplit(right)
    a_port = a.port or (443 if a.scheme == "https" else 80)
    b_port = b.port or (443 if b.scheme == "https" else 80)
    return (a.scheme, (a.hostname or "").lower(), a_port) == (b.scheme, (b.hostname or "").lower(), b_port)


def _normalized_link(value: str) -> str:
    parts = urlsplit(value)
    query = [
        (key, val)
        for key, val in parse_qsl(parts.query, keep_blank_values=True)
        if key.lower() not in TRACKING_PARAMS and not key.lower().startswith("utm_")
    ]
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    return urlunsplit((parts.scheme, parts.netloc, path, urlencode(query), ""))


def _metadata(tree: html.HtmlElement, page_url: str) -> tuple[str, str, str | None]:
    title = ""
    for query in (
        '//meta[@property="og:title"]/@content',
        '//meta[@name="twitter:title"]/@content',
        "//title/text()",
    ):
        values = tree.xpath(query)
        if values:
            title = _clean(str(values[0]), 500)
            if title:
                break
    description = ""
    for query in (
        '//meta[@property="og:description"]/@content',
        '//meta[@name="description"]/@content',
        '//meta[@name="twitter:description"]/@content',
    ):
        values = tree.xpath(query)
        if values:
            description = _clean(str(values[0]), 1_000)
            if description:
                break

    logo_url: str | None = None
    candidates = tree.xpath(
        '//link[contains(translate(@rel,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"icon")]/@href | '
        '//img[contains(translate(@class,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"logo")]/@src | '
        '//img[contains(translate(@id,"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"logo")]/@src'
    )
    for candidate in candidates:
        try:
            resolved = urljoin(page_url, str(candidate))
            if resolved.startswith(("http://", "https://")) and _same_origin(page_url, resolved):
                logo_url = resolved[:1_000]
                break
        except ValueError:
            continue
    return title, description, logo_url


def _extract_links(tree: html.HtmlElement, page_url: str) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for href in tree.xpath("//a[@href]/@href"):
        raw = str(href).strip()
        if not raw or raw.lower().startswith(("#", "javascript:", "data:", "mailto:", "tel:")):
            continue
        try:
            resolved = _normalized_link(urljoin(page_url, raw))
        except ValueError:
            continue
        parts = urlsplit(resolved)
        if parts.scheme not in {"http", "https"} or not _same_origin(page_url, resolved):
            continue
        if BLOCKED_PATH.search(parts.path) or BLOCKED_EXT.search(parts.path) or len(resolved) > 1_000:
            continue
        if resolved not in seen:
            seen.add(resolved)
            output.append(resolved)
        if len(output) >= 80:
            break
    return output


def _fallback_main_text(tree: html.HtmlElement) -> str:
    clone = html.fromstring(etree.tostring(tree, encoding="unicode"))
    removable = clone.xpath(
        "//script|//style|//noscript|//svg|//iframe|//template|//form|//nav|//footer|//header|//aside|"
        "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'cookie')]|"
        "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'modal')]|"
        "//*[contains(translate(@class,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'sidebar')]"
    )
    for node in removable:
        parent = node.getparent()
        if parent is not None:
            parent.remove(node)
    candidates = clone.xpath("//main|//article|//*[@role='main']")
    body = clone.find("body")
    target = max(
        candidates,
        key=lambda item: len(item.text_content()),
        default=body if body is not None else clone,
    )
    blocks: list[str] = []
    for node in target.xpath(".//h1|.//h2|.//h3|.//p|.//li"):
        value = _clean(node.text_content(), 3_000)
        if value and (not blocks or blocks[-1] != value):
            blocks.append(value)
    if not blocks:
        blocks = [_clean(target.text_content(), 30_000)]
    return "\n".join(blocks)


def _main_text(raw_html: str, tree: html.HtmlElement, page_url: str) -> str:
    try:
        import trafilatura  # Optional quality layer, pinned in the Docker build.

        value = trafilatura.extract(
            raw_html,
            url=page_url,
            include_comments=False,
            include_tables=True,
            deduplicate=True,
            favor_precision=True,
            output_format="markdown",
        )
        if value and len(value.strip()) >= 80:
            return value.strip()[:30_000]
    except Exception:
        pass
    return _fallback_main_text(tree)[:30_000]


def extract_page(raw_html: str, page_url: str) -> ExtractedPage:
    parser = html.HTMLParser(encoding="utf-8", recover=True, remove_comments=True, no_network=True)
    try:
        tree = html.fromstring(raw_html, parser=parser, base_url=page_url)
    except (etree.ParserError, ValueError) as exc:
        raise ValueError("HTML could not be parsed") from exc
    title, description, logo_url = _metadata(tree, page_url)
    text = _main_text(raw_html, tree, page_url)
    colors = list(dict.fromkeys(match.group(0).upper() for match in HEX_COLOR_RE.finditer(raw_html)))[:12]
    fonts: list[str] = []
    for match in FONT_RE.finditer(raw_html):
        for value in match.group(1).split(","):
            font = value.strip(" \t\r\n'\"")
            if font and font.lower() not in {"inherit", "initial", "serif", "sans-serif", "monospace"} and font not in fonts:
                fonts.append(font[:100])
            if len(fonts) >= 8:
                break
        if len(fonts) >= 8:
            break
    return ExtractedPage(
        title=title,
        description=description,
        text=text,
        links=_extract_links(tree, page_url),
        colors=colors,
        fonts=fonts,
        logo_url=logo_url,
        suspicious_prompt_text=bool(PROMPT_PATTERN.search(text)),
    )
