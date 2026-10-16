"""Database snapshots: the free-tier workaround for having no persistent disk.

A scheduled GitHub Action crawls every few hours, exports a compact snapshot and attaches it to a release.
On boot, an empty server downloads the newest snapshot and serves jobs within seconds instead of re-crawling
for minutes; the normal background sync then refreshes it.

    python -m backend.app.snapshot build out.gz     # what the Action runs
"""
from __future__ import annotations

import asyncio
import gzip
import logging
import os
import shutil
import sqlite3
import sys
from pathlib import Path

import httpx

from .config import settings
from .security import download_github_release_asset

logger = logging.getLogger(__name__)
MAX_DB_BYTES = 500_000_000
REQUIRED_TABLES = {"companies", "jobs", "preferences", "notifications", "reports"}


def export_snapshot(db_path: Path, dest_gz: Path) -> int:
    """Write a gzip'd, user-state-free copy of the database. Returns the number of jobs exported."""
    tmp = dest_gz.with_suffix(".tmp.db")
    tmp.unlink(missing_ok=True)
    src = sqlite3.connect(db_path)
    try:
        src.execute("VACUUM INTO ?", (str(tmp),))
    finally:
        src.close()
    con = sqlite3.connect(tmp)
    try:
        # Personal/global state never travels in a snapshot; raw payloads are dead weight.
        con.executescript("DELETE FROM notifications; DELETE FROM reports; DELETE FROM preferences; UPDATE jobs SET is_saved = 0, raw_json = NULL;")
        con.commit()
        con.execute("VACUUM")
        count = con.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    finally:
        con.close()
    with open(tmp, "rb") as fin, gzip.open(dest_gz, "wb", compresslevel=9) as fout:
        shutil.copyfileobj(fin, fout)
    tmp.unlink(missing_ok=True)
    return count


def validate_snapshot(path: Path) -> int:
    """Raise ValueError unless `path` is a sane Jobly database. Returns its job count."""
    try:
        con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            if con.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError("integrity check failed")
            tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if not REQUIRED_TABLES <= tables:
                raise ValueError(f"missing tables: {sorted(REQUIRED_TABLES - tables)}")
            jobs = con.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        finally:
            con.close()
    except sqlite3.Error as exc:
        raise ValueError(f"not a valid database: {exc}") from exc
    if not 1 <= jobs <= 500_000:
        raise ValueError(f"implausible job count: {jobs}")
    return jobs


def install_snapshot(gz_path: Path, db_path: Path) -> int:
    """Gunzip (size-capped), validate, then atomically replace the database. Returns the job count."""
    tmp = db_path.with_suffix(".restore.db")
    try:
        size = 0
        with gzip.open(gz_path, "rb") as fin, open(tmp, "wb") as fout:
            while chunk := fin.read(1 << 20):
                size += len(chunk)
                if size > MAX_DB_BYTES:
                    raise ValueError("snapshot is too large")
                fout.write(chunk)
        jobs = validate_snapshot(tmp)
        for suffix in ("-wal", "-shm"):
            Path(str(db_path) + suffix).unlink(missing_ok=True)
        os.replace(tmp, db_path)
        return jobs
    finally:
        tmp.unlink(missing_ok=True)


def _has_jobs(db_path: Path) -> bool:
    if not db_path.exists():
        return False
    try:
        con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            return con.execute("SELECT COUNT(*) FROM jobs").fetchone()[0] > 0
        finally:
            con.close()
    except sqlite3.Error:
        return False


async def restore_snapshot_if_needed(client: httpx.AsyncClient | None = None) -> bool:
    """On an empty database, try to restore the latest published snapshot. Never raises: a failed restore just
    means the normal first-boot crawl runs instead."""
    if not settings.SNAPSHOT_REPO or _has_jobs(settings.DATABASE_PATH):
        return False
    db_path = settings.DATABASE_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    gz = db_path.with_suffix(".snapshot.gz")
    owns_client = client is None
    client = client or httpx.AsyncClient()
    try:
        ok = await download_github_release_asset(
            client, settings.SNAPSHOT_REPO, settings.SNAPSHOT_TAG, settings.SNAPSHOT_ASSET, gz, token=settings.SNAPSHOT_TOKEN
        )
        if not ok:
            logger.info("[Snapshot] No snapshot available; the first sync will populate the database")
            return False
        jobs = await asyncio.to_thread(install_snapshot, gz, db_path)
        logger.info("[Snapshot] Restored %d jobs from the latest snapshot", jobs)
        return True
    except Exception as exc:  # network, validation, disk...: fall back to crawling
        logger.warning("[Snapshot] Restore failed (%s); falling back to a normal crawl", exc)
        return False
    finally:
        gz.unlink(missing_ok=True)
        if owns_client:
            await client.aclose()


async def _build(out: Path) -> int:
    from .db import init_db
    from .ingestion.runner import sync_all_sources
    from .seed import seed_companies_if_missing

    await init_db()
    await seed_companies_if_missing()
    summary = await sync_all_sources()
    logger.info("Crawled: %s", {k: v for k, v in summary.items() if k != "errors"})
    return await asyncio.to_thread(export_snapshot, settings.DATABASE_PATH, out)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] != "build":
        sys.exit("usage: python -m backend.app.snapshot build <out.gz>")
    logging.basicConfig(level=logging.INFO)
    count = asyncio.run(_build(Path(sys.argv[2])))
    print(f"snapshot: {count} jobs -> {sys.argv[2]}")
    if count < 1000:
        sys.exit("refusing to publish a suspiciously small snapshot")
