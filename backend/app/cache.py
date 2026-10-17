"""Read-path protection for a small free-tier server (0.1 CPU, 512 MB).

Most traffic is the extension's background check, and many people send the very same query. So:
  * identical GETs are answered from memory for a short while (the job data only changes when a crawl finishes),
  * identical requests that arrive together are computed once (single-flight),
  * at most a few database-heavy requests run at once, the rest wait briefly and then get a quick "busy" answer
    instead of piling up in memory until the instance is killed,
  * responses carry an ETag, so a browser that already has the data gets a tiny 304 instead of the body.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import OrderedDict
from urllib.parse import parse_qsl, urlencode

from .config import settings

CACHEABLE_PATHS = {"/api/jobs", "/api/stats", "/api/companies"}
MAX_ENTRIES = 400
MAX_TOTAL_BYTES = 24 * 1024 * 1024
MAX_ENTRY_BYTES = 400 * 1024


class _Store:
    def __init__(self) -> None:
        self.entries: OrderedDict[str, tuple[float, list[tuple[bytes, bytes]], bytes, str]] = OrderedDict()
        self.total_bytes = 0

    def get(self, key: str, now: float):
        entry = self.entries.get(key)
        if entry is None:
            return None
        if entry[0] <= now:
            self._drop(key)
            return None
        self.entries.move_to_end(key)
        return entry

    def put(self, key: str, expires: float, headers: list[tuple[bytes, bytes]], body: bytes, etag: str) -> None:
        if key in self.entries:
            self._drop(key)
        self.entries[key] = (expires, headers, body, etag)
        self.total_bytes += len(body)
        while self.entries and (len(self.entries) > MAX_ENTRIES or self.total_bytes > MAX_TOTAL_BYTES):
            self._drop(next(iter(self.entries)))

    def _drop(self, key: str) -> None:
        entry = self.entries.pop(key, None)
        if entry is not None:
            self.total_bytes -= len(entry[2])

    def clear(self) -> None:
        self.entries.clear()
        self.total_bytes = 0


_store = _Store()


def clear_response_cache() -> None:
    """Call after the job data changed (a crawl finished) so nobody is served the old list."""
    _store.clear()


def _worth_caching(path: str, body: bytes) -> bool:
    # Never pin a "still gathering" answer: the client polls these until real data shows up.
    if path == "/api/stats":
        return b'"is_syncing":true' not in body and b'"total_jobs":0,' not in body
    if path == "/api/jobs":
        return b'"total":0,' not in body
    return True


def _etag(body: bytes) -> str:
    return '"' + hashlib.sha1(body).hexdigest()[:16] + '"'


def _matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    tags = [t.strip().removeprefix("W/") for t in if_none_match.split(",")]
    return etag in tags or "*" in tags


class ResponseCacheMiddleware:
    def __init__(self, app, max_concurrent: int | None = None, queue_timeout: float | None = None):
        self.app = app
        self._max_concurrent = max_concurrent
        self._queue_timeout = queue_timeout
        self._loop: asyncio.AbstractEventLoop | None = None
        self._sem: asyncio.Semaphore | None = None
        self._flights: dict[str, list] = {}  # key -> [lock, waiters]

    # asyncio primitives belong to one event loop (tests start a new loop per test case)
    def _semaphore(self) -> asyncio.Semaphore:
        loop = asyncio.get_running_loop()
        if self._sem is None or self._loop is not loop:
            self._loop = loop
            self._sem = asyncio.Semaphore(self._max_concurrent or settings.MAX_CONCURRENT_QUERIES)
            self._flights = {}
        return self._sem

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "GET" or not scope["path"].startswith("/api/"):
            return await self.app(scope, receive, send)

        path = scope["path"]
        ttl = settings.RESPONSE_CACHE_TTL_SECONDS
        cacheable = ttl > 0 and path in CACHEABLE_PATHS
        sem = self._semaphore()
        if_none_match = next((v.decode("latin-1") for k, v in scope["headers"] if k == b"if-none-match"), None)

        key = ""
        if cacheable:
            query = urlencode(sorted(parse_qsl(scope["query_string"].decode("latin-1"), keep_blank_values=True)))
            key = f"{path}?{query}"
            hit = _store.get(key, time.monotonic())
            if hit:
                return await self._reply(send, hit[1], hit[2], hit[3], if_none_match, "HIT")

        # Single-flight: concurrent identical requests wait for the first one's answer.
        flight = None
        held = False
        if cacheable:
            flight = self._flights.setdefault(key, [asyncio.Lock(), 0])
            flight[1] += 1
        try:
            if flight:
                await flight[0].acquire()
                held = True
                hit = _store.get(key, time.monotonic())
                if hit:
                    return await self._reply(send, hit[1], hit[2], hit[3], if_none_match, "HIT")
            try:
                await asyncio.wait_for(sem.acquire(), timeout=self._queue_timeout or settings.QUERY_QUEUE_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                return await self._busy(send)
            try:
                if not cacheable:
                    return await self.app(scope, receive, send)
                return await self._compute(scope, receive, send, key, path, ttl, if_none_match)
            finally:
                sem.release()
        finally:
            if held:
                flight[0].release()
            if flight:
                flight[1] -= 1
                if flight[1] <= 0:
                    self._flights.pop(key, None)

    async def _compute(self, scope, receive, send, key, path, ttl, if_none_match):
        start: dict = {}
        chunks: list[bytes] = []

        async def capture(message):
            if message["type"] == "http.response.start":
                start.update(message)
            elif message["type"] == "http.response.body":
                chunks.append(message.get("body", b""))

        await self.app(scope, receive, capture)
        body = b"".join(chunks)
        headers = [(k, v) for k, v in start.get("headers", []) if k not in (b"etag", b"cache-control")]
        if start.get("status") != 200:
            await send({"type": "http.response.start", "status": start.get("status", 500), "headers": headers})
            return await send({"type": "http.response.body", "body": body})
        etag = _etag(body)
        if len(body) <= MAX_ENTRY_BYTES and _worth_caching(path, body):
            _store.put(key, time.monotonic() + ttl, headers, body, etag)
        await self._reply(send, headers, body, etag, if_none_match, "MISS")

    @staticmethod
    async def _reply(send, headers, body: bytes, etag: str, if_none_match: str | None, state: str):
        extra = [(b"etag", etag.encode()), (b"cache-control", b"private, no-cache"), (b"x-cache", state.encode())]
        if _matches(if_none_match, etag):
            kept = [(k, v) for k, v in headers if k not in (b"content-length", b"content-type", b"content-encoding")]
            await send({"type": "http.response.start", "status": 304, "headers": kept + extra})
            return await send({"type": "http.response.body", "body": b""})
        await send({"type": "http.response.start", "status": 200, "headers": list(headers) + extra})
        await send({"type": "http.response.body", "body": body})

    @staticmethod
    async def _busy(send):
        body = json.dumps({"detail": "Jobly is busy right now. Try again in a moment."}).encode()
        await send({"type": "http.response.start", "status": 503, "headers": [
            (b"content-type", b"application/json"), (b"content-length", str(len(body)).encode()), (b"retry-after", b"3")]})
        await send({"type": "http.response.body", "body": body})
