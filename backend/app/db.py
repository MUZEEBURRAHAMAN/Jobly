import aiosqlite
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from .config import settings

def get_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

@asynccontextmanager
async def get_db_connection():
    db = await aiosqlite.connect(settings.DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    try:
        yield db
    finally:
        await db.close()

async def init_db():
    async with get_db_connection() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                careers_url TEXT,
                source_type TEXT NOT NULL,
                source_identifier TEXT NOT NULL,
                industry TEXT,
                logo_url TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL,
                company_name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                external_id TEXT NOT NULL,
                title TEXT NOT NULL,
                normalized_role TEXT,
                seniority TEXT,
                work_mode TEXT,
                location TEXT,
                description TEXT,
                application_url TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                is_saved INTEGER NOT NULL DEFAULT 0,
                raw_json TEXT,
                salary_summary TEXT,
                min_salary INTEGER,
                max_salary INTEGER,
                geo_hub TEXT,
                experience_tier TEXT,
                UNIQUE(source_type, external_id),
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
        """)

        # Migration check: ensure enrichment columns exist in existing databases
        pragma_cur = await db.execute("PRAGMA table_info(jobs);")
        existing_cols = {row["name"] for row in await pragma_cur.fetchall()}
        new_cols = {
            "salary_summary": "TEXT",
            "min_salary": "INTEGER",
            "max_salary": "INTEGER",
            "geo_hub": "TEXT",
            "experience_tier": "TEXT"
        }
        for col_name, col_type in new_cols.items():
            if col_name not in existing_cols:
                await db.execute(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type};")

        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_role ON jobs(normalized_role);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_jobs_first_seen ON jobs(first_seen_at);")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                roles TEXT NOT NULL,
                seniorities TEXT NOT NULL,
                locations TEXT NOT NULL,
                remote_only INTEGER NOT NULL DEFAULT 0,
                custom_keywords TEXT NOT NULL DEFAULT '',
                excluded_keywords TEXT NOT NULL DEFAULT '',
                notify_enabled INTEGER NOT NULL DEFAULT 1,
                sync_interval_mins INTEGER NOT NULL DEFAULT 30,
                updated_at TEXT NOT NULL
            );
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                company_name TEXT NOT NULL,
                role TEXT NOT NULL,
                location TEXT,
                application_url TEXT NOT NULL,
                sent_at TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0,
                UNIQUE(job_id),
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
            );
        """)

        # S-3 FIX: Reports table so user reports are persisted
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
            );
        """)

        # Insert default preferences row if not exists
        cursor = await db.execute("SELECT id FROM preferences LIMIT 1;")
        row = await cursor.fetchone()
        if not row:
            now = get_utc_now()
            default_roles = json.dumps(["product_design", "frontend_engineering"])
            default_seniorities = json.dumps(["mid", "senior", "lead"])
            default_locations = json.dumps([])
            await db.execute("""
                INSERT INTO preferences (
                    roles, seniorities, locations, remote_only,
                    custom_keywords, excluded_keywords, notify_enabled,
                    sync_interval_mins, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                default_roles,
                default_seniorities,
                default_locations,
                0,
                "",
                "",
                1,
                30,
                now
            ))
        await db.commit()
