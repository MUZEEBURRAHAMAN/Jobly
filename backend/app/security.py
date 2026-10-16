"""Security helpers: URL validation / SSRF guard, rate limiting, security headers, admin auth."""
from __future__ import annotations

import asyncio
import hmac
import ipaddress
import json
import socket
import time
from collections import deque
from urllib.parse import urljoin, urlsplit

import httpx
from fastapi import Header, HTTPException

from .config import settings

MAX_URL_LENGTH = 2048


class UnsafeURL(ValueError):
    """Raised when a URL must not be fetched or displayed."""


def sanitize_http_url(url: str | None) -> str | None:
    """Return the URL only if it is a plain http(s) URL with a host; otherwise None."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if len(url) > MAX_URL_LENGTH or any(c in url for c in ("\n", "\r", "\x00", " ")):
        return None
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme.lower() not in ("http", "https") or not parts.hostname:
        return None
    return url


def _ip_is_public(ip: ipaddress._BaseAddress) -> bool:
    if ip.version == 6 and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


def check_url_syntax(url: str) -> str:
    """Synchronous checks (no DNS): scheme, host, port, credentials, literal private IPs."""
    clean = sanitize_http_url(url)
    if clean is None:
        raise UnsafeURL("URL must be a valid http(s) URL")
    parts = urlsplit(clean)
    if parts.username or parts.password:
        raise UnsafeURL("URLs with embedded credentials are not allowed")
    if parts.port not in (None, 80, 443):
        raise UnsafeURL("Only ports 80 and 443 are allowed")
    host = parts.hostname or ""
    if host.lower() in ("localhost",) or host.lower().endswith((".localhost", ".local", ".internal")):
        raise UnsafeURL("Host is not publicly routable")
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        return clean  # a hostname; resolved later
    if not _ip_is_public(literal):
        raise UnsafeURL("Host is not publicly routable")
    return clean


async def validate_public_url(url: str) -> str:
    """Full SSRF check: syntax plus DNS resolution; every resolved address must be public."""
    clean = check_url_syntax(url)
    host = urlsplit(clean).hostname or ""
    try:
        ipaddress.ip_address(host)
        return clean
    except ValueError:
        pass
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise UnsafeURL("Host could not be resolved") from exc
    if not infos:
        raise UnsafeURL("Host could not be resolved")
    for info in infos:
        if not _ip_is_public(ipaddress.ip_address(info[4][0])):
            raise UnsafeURL("Host resolves to a non-public address")
    return clean


async def fetch_public_text(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 12.0,
    max_bytes: int = 2_000_000,
    max_redirects: int = 3,
) -> tuple[int, str]:
    """GET a public URL. Every redirect hop is re-validated and the body size is capped.

    Residual risk: DNS can change between validation and connect (rebinding). Run on a
    host with no sensitive internal network access.
    """
    current = url
    for _ in range(max_redirects + 1):
        current = await validate_public_url(current)
        async with client.stream("GET", current, headers=headers, timeout=timeout, follow_redirects=False) as resp:
            if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
                current = urljoin(current, resp.headers["location"])
                continue
            chunks: list[bytes] = []
            size = 0
            async for chunk in resp.aiter_bytes():
                size += len(chunk)
                if size > max_bytes:
                    break
                chunks.append(chunk)
            return resp.status_code, b"".join(chunks).decode(resp.encoding or "utf-8", errors="replace")
    raise UnsafeURL("Too many redirects")


# --------------------------------------------------------------------------- admin auth
async def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """Protect global-state mutations (company management). Disabled unless ADMIN_TOKEN is set."""
    expected = settings.ADMIN_TOKEN
    if not expected:
        raise HTTPException(status_code=403, detail="This action is disabled on this server")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


# --------------------------------------------------------------------------- rate limiting
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_UNLIMITED_PATHS = {"/health"}


def client_ip(scope: dict) -> str:
    """Prefer Cloudflare's CF-Connecting-IP (overwritten by the edge, not spoofable through it);
    fall back to the socket peer. X-Forwarded-For is deliberately ignored (spoofable)."""
    for name, value in scope.get("headers", []):
        if name == b"cf-connecting-ip":
            return value.decode("latin-1").strip()[:64]
    client = scope.get("client")
    return client[0] if client else "unknown"


class RateLimitMiddleware:
    """Small in-memory sliding-window limiter (per instance; fine for a single Render service)."""

    def __init__(self, app, general_per_min: int | None = None, write_per_min: int | None = None,
                 sync_per_min: int | None = None, max_tracked: int = 20000):
        self.app = app
        self.general = settings.RATE_LIMIT_PER_MIN if general_per_min is None else general_per_min
        self.write = settings.RATE_LIMIT_WRITES_PER_MIN if write_per_min is None else write_per_min
        self.sync = settings.RATE_LIMIT_SYNC_PER_MIN if sync_per_min is None else sync_per_min
        self.max_tracked = max_tracked
        self.hits: dict[tuple[str, str], deque] = {}

    def _allow(self, key: tuple[str, str], limit: int, now: float) -> float | None:
        """Return None if allowed, else seconds until the oldest hit expires."""
        if limit <= 0:
            return None
        q = self.hits.get(key)
        if q is None:
            if len(self.hits) >= self.max_tracked:
                self._prune(now)
            q = self.hits[key] = deque()
        while q and now - q[0] >= 60:
            q.popleft()
        if len(q) >= limit:
            return max(1.0, 60 - (now - q[0]))
        q.append(now)
        return None

    def _prune(self, now: float) -> None:
        for key in [k for k, q in self.hits.items() if not q or now - q[-1] >= 60]:
            del self.hits[key]
        if len(self.hits) >= self.max_tracked:
            self.hits.clear()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] in _UNLIMITED_PATHS or scope["method"] == "OPTIONS":
            return await self.app(scope, receive, send)
        ip = client_ip(scope)
        now = time.monotonic()
        checks = [("any", self.general)]
        if scope["method"] not in _SAFE_METHODS:
            checks.append(("write", self.write))
        if scope["path"] == "/api/sync" and scope["method"] == "POST":
            checks.append(("sync", self.sync))
        for name, limit in checks:
            retry = self._allow((ip, name), limit, now)
            if retry is not None:
                body = json.dumps({"detail": "Too many requests"}).encode()
                await send({"type": "http.response.start", "status": 429, "headers": [
                    (b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()),
                    (b"retry-after", str(int(retry)).encode())]})
                await send({"type": "http.response.body", "body": body})
                return
        await self.app(scope, receive, send)


class SecurityHeadersMiddleware:
    HEADERS = [
        (b"x-content-type-options", b"nosniff"),
        (b"x-frame-options", b"DENY"),
        (b"referrer-policy", b"no-referrer"),
    ]

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                present = {k.lower() for k, _ in message.get("headers", [])}
                message["headers"] = list(message.get("headers", [])) + [h for h in self.HEADERS if h[0] not in present]
            await send(message)

        await self.app(scope, receive, send_wrapper)
