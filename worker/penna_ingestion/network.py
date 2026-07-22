from __future__ import annotations

import http.client
import ipaddress
import re
import socket
import ssl
import zlib
from dataclasses import dataclass
from urllib.parse import SplitResult, urlsplit, urlunsplit

from .errors import IngestionError, SecurityPolicyError

MAX_URL_CHARS = 1_000
DEFAULT_MAX_BYTES = 1_500_000
DEFAULT_TIMEOUT_SECONDS = 8.0
ALLOWED_PORTS = {80, 443}
BLOCKED_HOSTS = {
    "localhost",
    "localhost.localdomain",
    "metadata.google.internal",
    "metadata.azure.internal",
    "instance-data",
}
BLOCKED_SUFFIXES = (
    ".localhost",
    ".local",
    ".internal",
    ".home.arpa",
    ".nip.io",
    ".sslip.io",
    ".xip.io",
    ".1u.ms",
)
REDIRECT_CODES = {301, 302, 303, 307, 308}
_CHARSET_RE = re.compile(r"charset\s*=\s*['\"]?([^;\s'\"]+)", re.I)


@dataclass(frozen=True)
class FetchResult:
    url: str
    status: int
    headers: dict[str, str]
    body: bytes

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").split(";", 1)[0].strip().lower()

    def text(self) -> str:
        content_type = self.headers.get("content-type", "")
        match = _CHARSET_RE.search(content_type)
        encoding = match.group(1) if match else "utf-8"
        try:
            return self.body.decode(encoding, errors="replace")
        except LookupError:
            return self.body.decode("utf-8", errors="replace")


def _format_netloc(parts: SplitResult, ascii_host: str, port: int) -> str:
    host = f"[{ascii_host}]" if ":" in ascii_host else ascii_host
    default_port = 443 if parts.scheme.lower() == "https" else 80
    return host if port == default_port else f"{host}:{port}"


def normalize_url(value: str) -> str:
    raw = (value or "").strip()
    if not raw or len(raw) > MAX_URL_CHARS:
        raise SecurityPolicyError("invalid_url")
    if "\\" in raw or any(ord(char) < 32 for char in raw):
        raise SecurityPolicyError("ambiguous_url")
    if "://" not in raw:
        raw = f"https://{raw}"
    try:
        parts = urlsplit(raw)
        scheme = parts.scheme.lower()
        if scheme not in {"http", "https"} or not parts.hostname:
            raise SecurityPolicyError("unsupported_scheme")
        if parts.username is not None or parts.password is not None:
            raise SecurityPolicyError("userinfo_not_allowed")
        parsed_host = parts.hostname.split("%", 1)[0]
        try:
            ascii_host = ipaddress.ip_address(parsed_host).compressed
        except ValueError:
            ascii_host = parsed_host.encode("idna").decode("ascii").rstrip(".").lower()
        if not ascii_host or len(ascii_host) > 253:
            raise SecurityPolicyError("invalid_host")
        if ascii_host in BLOCKED_HOSTS or ascii_host.endswith(BLOCKED_SUFFIXES):
            raise SecurityPolicyError("blocked_host")
        port = parts.port or (443 if scheme == "https" else 80)
        if port not in ALLOWED_PORTS:
            raise SecurityPolicyError("blocked_port")
        path = parts.path or "/"
        if len(path) > 2_048 or len(parts.query) > 2_048:
            raise SecurityPolicyError("oversized_url")
        return urlunsplit((scheme, _format_netloc(parts, ascii_host, port), path, parts.query, ""))
    except SecurityPolicyError:
        raise
    except (UnicodeError, ValueError) as exc:
        raise SecurityPolicyError("invalid_url") from exc
    except Exception as exc:
        raise SecurityPolicyError("invalid_url") from exc


def _is_public_address(value: str) -> bool:
    try:
        address = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        address = address.ipv4_mapped
    return bool(address.is_global)


def resolve_public_addresses(hostname: str, port: int) -> list[str]:
    try:
        records = socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise IngestionError("dns_failed", "Fant ikke nettstedet. Kontroller adressen og prøv igjen.") from exc
    addresses: list[str] = []
    for record in records:
        address = record[4][0]
        if address not in addresses:
            addresses.append(address)
    # Fail closed on mixed public/private DNS answers. Accepting only the public
    # answer creates a rebinding primitive when the resolver order changes.
    if not addresses or any(not _is_public_address(address) for address in addresses):
        raise SecurityPolicyError("private_or_mixed_dns")
    return addresses


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host: str, port: int, connect_ip: str, *, timeout: float):
        self._connect_ip = connect_ip
        super().__init__(host=host, port=port, timeout=timeout)

    def connect(self) -> None:
        self.sock = socket.create_connection((self._connect_ip, self.port), self.timeout)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host: str, port: int, connect_ip: str, *, timeout: float):
        self._connect_ip = connect_ip
        super().__init__(host=host, port=port, timeout=timeout, context=ssl.create_default_context())

    def connect(self) -> None:
        sock = socket.create_connection((self._connect_ip, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def _read_bounded(response: http.client.HTTPResponse, max_bytes: int) -> bytes:
    declared = response.getheader("content-length")
    if declared:
        try:
            if int(declared) > max_bytes:
                raise IngestionError("response_too_large", "Nettstedet er for stort til å analyseres.")
        except ValueError:
            pass
    body = response.read(max_bytes + 1)
    if len(body) > max_bytes:
        raise IngestionError("response_too_large", "Nettstedet er for stort til å analyseres.")
    encoding = (response.getheader("content-encoding") or "").lower().strip()
    if encoding in {"", "identity"}:
        return body
    if encoding in {"gzip", "deflate"}:
        window = zlib.MAX_WBITS | 16 if encoding == "gzip" else zlib.MAX_WBITS
        try:
            inflater = zlib.decompressobj(window)
            output = inflater.decompress(body, max_bytes + 1)
            if inflater.unconsumed_tail or len(output) > max_bytes:
                raise IngestionError("response_too_large", "Nettstedet er for stort til å analyseres.")
            output += inflater.flush(max_bytes + 1 - len(output))
        except IngestionError:
            raise
        except zlib.error as exc:
            raise IngestionError("invalid_compression", "Nettstedet returnerte ugyldig innhold.") from exc
    else:
        raise IngestionError("unsupported_compression", "Nettstedet bruker et format som ikke støttes.")
    if len(output) > max_bytes:
        raise IngestionError("response_too_large", "Nettstedet er for stort til å analyseres.")
    return output


def fetch_once(
    value: str,
    *,
    max_bytes: int = DEFAULT_MAX_BYTES,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    user_agent: str = "PennaBrandBot/1.0 (+https://penna.no/bot)",
) -> FetchResult:
    url = normalize_url(value)
    parts = urlsplit(url)
    host = parts.hostname or ""
    port = parts.port or (443 if parts.scheme == "https" else 80)
    addresses = resolve_public_addresses(host, port)
    path = parts.path or "/"
    if parts.query:
        path += f"?{parts.query}"
    host_header = _format_netloc(parts, host, port)
    last_error: Exception | None = None

    for address in addresses:
        connection: http.client.HTTPConnection
        if parts.scheme == "https":
            connection = _PinnedHTTPSConnection(host, port, address, timeout=timeout_seconds)
        else:
            connection = _PinnedHTTPConnection(host, port, address, timeout=timeout_seconds)
        try:
            connection.request(
                "GET",
                path,
                headers={
                    "Host": host_header,
                    "User-Agent": user_agent,
                    "Accept": "text/html,application/xhtml+xml,text/plain;q=0.7,*/*;q=0.1",
                    "Accept-Encoding": "identity",
                    "Connection": "close",
                },
            )
            response = connection.getresponse()
            headers = {key.lower(): value for key, value in response.getheaders()}
            body = _read_bounded(response, max_bytes)
            return FetchResult(url=url, status=response.status, headers=headers, body=body)
        except IngestionError:
            raise
        except (OSError, ssl.SSLError, http.client.HTTPException) as exc:
            last_error = exc
        finally:
            connection.close()
    raise IngestionError("fetch_failed", "Kunne ikke hente nettstedet. Prøv igjen senere.") from last_error
