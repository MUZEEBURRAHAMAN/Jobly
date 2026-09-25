import asyncio
import json
import sys
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from backend.app.db import get_db_connection, init_db, get_utc_now
from backend.app.config import settings

async def seed():
    print("Initializing database...")
    await init_db()

    companies_file = settings.COMPANIES_FILE
    if not companies_file.exists():
        print(f"Error: {companies_file} not found.")
        return

    with open(companies_file, "r") as f:
        companies = json.load(f)

    now = get_utc_now()
    async with get_db_connection() as db:
        inserted = 0
        updated = 0
        for c in companies:
            cur = await db.execute("SELECT id FROM companies WHERE slug = ?", (c["slug"],))
            existing = await cur.fetchone()
            if existing:
                await db.execute("""
                    UPDATE companies SET
                        name = ?,
                        careers_url = ?,
                        source_type = ?,
                        source_identifier = ?,
                        industry = ?,
                        logo_url = ?,
                        updated_at = ?
                    WHERE slug = ?
                """, (
                    c["name"],
                    c.get("careers_url"),
                    c["source_type"].lower(),
                    c["source_identifier"],
                    c.get("industry"),
                    c.get("logo_url"),
                    now,
                    c["slug"]
                ))
                updated += 1
            else:
                await db.execute("""
                    INSERT INTO companies (
                        name, slug, careers_url, source_type,
                        source_identifier, industry, logo_url,
                        is_active, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """, (
                    c["name"],
                    c["slug"],
                    c.get("careers_url"),
                    c["source_type"].lower(),
                    c["source_identifier"],
                    c.get("industry"),
                    c.get("logo_url"),
                    now,
                    now
                ))
                inserted += 1
        await db.commit()

        cur = await db.execute("SELECT COUNT(*) as count FROM companies")
        total = (await cur.fetchone())["count"]
        print(f"✅ Seeding complete: {inserted} added, {updated} updated. Total companies in DB: {total}")

if __name__ == "__main__":
    asyncio.run(seed())
