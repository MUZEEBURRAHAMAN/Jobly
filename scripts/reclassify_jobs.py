import asyncio
import json
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from backend.app.db import get_db_connection, get_utc_now
from backend.app.matching import detect_role, detect_seniority, detect_work_mode

async def reclassify():
    print("🔄 Reclassifying all stored jobs with updated taxonomy...")
    async with get_db_connection() as db:
        # 1. Reset preferences to clean default
        default_roles = json.dumps(["product_design", "frontend_engineering", "product_management", "ai_ml", "fullstack_engineering"])
        default_seniorities = json.dumps(["intern", "junior", "mid", "senior", "lead"])
        now = get_utc_now()
        await db.execute("""
            UPDATE preferences SET
                roles = ?,
                seniorities = ?,
                locations = '[]',
                remote_only = 0,
                custom_keywords = '',
                excluded_keywords = '',
                notify_enabled = 1,
                sync_interval_mins = 30,
                updated_at = ?
        """, (default_roles, default_seniorities, now))

        # 2. Fetch all jobs and update roles, seniorities, work modes
        cur = await db.execute("SELECT id, title, location FROM jobs")
        jobs = await cur.fetchall()

        updated = 0
        role_counts = {}

        for j in jobs:
            role = detect_role(j["title"])
            seniority = detect_seniority(j["title"])
            work_mode = detect_work_mode(j["location"], j["title"])

            role_key = role or "other"
            role_counts[role_key] = role_counts.get(role_key, 0) + 1

            await db.execute("""
                UPDATE jobs SET
                    normalized_role = ?,
                    seniority = ?,
                    work_mode = ?
                WHERE id = ?
            """, (role, seniority, work_mode, j["id"]))
            updated += 1

        await db.commit()

        print(f"✅ Reclassified {updated} jobs successfully!")
        print("\n📊 New Role Distribution:")
        for r, cnt in sorted(role_counts.items(), key=lambda x: -x[1]):
            print(f"  {r:<25}: {cnt}")

if __name__ == "__main__":
    asyncio.run(reclassify())
