import asyncio
import json
import re
import sys
from pathlib import Path

backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from backend.app.db import get_db_connection

def detect_geo_hub(location: str | None, title: str | None) -> str:
    text = f"{location or ''} {title or ''}".lower()
    if any(k in text for k in ['india', 'bengaluru', 'bangalore', 'gurgaon', 'gurugram', 'hyderabad', 'mumbai', 'pune', 'noida', 'delhi']):
        return 'india'
    if any(k in text for k in [
        'united states', 'usa', 'san francisco', 'sf bay', 'new york', 'nyc', 'seattle',
        'austin', 'california', ' ca', ' ny', ' wa', ' tx', ' ma', 'boston', 'los angeles',
        'remote - us', 'us - remote', 'remote (us)', 'remote, us'
    ]):
        return 'us'
    if any(k in text for k in [
        'london', 'united kingdom', ' uk', 'germany', 'berlin', 'munich', 'france',
        'paris', 'amsterdam', 'netherlands', 'dublin', 'ireland', 'sweden', 'stockholm', 'switzerland', 'zurich'
    ]):
        return 'europe'
    if any(k in text for k in ['singapore', 'tokyo', 'japan', 'sydney', 'australia', 'melbourne', 'korea', 'seoul']):
        return 'apac'
    return 'global'

def detect_experience_tier(seniority: str | None, title: str | None) -> str:
    sen = (seniority or "mid").lower()
    if sen == "intern" or sen == "junior":
        return "0-2"
    if sen == "lead":
        return "8+"
    if sen == "senior":
        return "5-8"
    return "2-5"

def parse_compensation(source_type: str, raw_json: str | None, description: str | None):
    # 1. Ashby native compensation
    if source_type == 'ashby' and raw_json:
        try:
            d = json.loads(raw_json)
            comp = d.get('compensation', {})
            if comp:
                summary = comp.get('scrapeableCompensationSalarySummary') or comp.get('compensationTierSummary')
                min_v = None
                max_v = None
                tiers = comp.get('compensationTiers', [])
                for t in tiers:
                    for c in t.get('components', []):
                        if c.get('compensationType') == 'Salary':
                            min_v = c.get('minValue')
                            max_v = c.get('maxValue')
                            break
                if summary:
                    # Clean up
                    summary = summary.replace('• Offers Equity', '• Equity').strip()
                    return summary, min_v, max_v
        except Exception:
            pass

    # 2. Regex on description
    text = description or ''
    if text:
        m = re.search(r'\$([0-9]{2,3}),?([0-9]{3})\s*(?:-|to|–)\s*\$([0-9]{2,3}),?([0-9]{3})', text)
        if m:
            v1 = int(m.group(1) + m.group(2))
            v2 = int(m.group(3) + m.group(4))
            return f"${v1//1000}K - ${v2//1000}K", v1, v2
        m_k = re.search(r'\$([0-9]{2,3})[kK]\s*(?:-|to|–)\s*\$([0-9]{2,3})[kK]', text)
        if m_k:
            v1 = int(m_k.group(1)) * 1000
            v2 = int(m_k.group(2)) * 1000
            return f"${m_k.group(1)}K - ${m_k.group(2)}K", v1, v2
        m_inr = re.search(r'(?:₹|INR)\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:-|to|–)\s*([0-9]{1,2}(?:\.[0-9]+)?)\s*(?:LPA|Lakhs|L)', text, re.I)
        if m_inr:
            v1 = int(float(m_inr.group(1)) * 100000)
            v2 = int(float(m_inr.group(2)) * 100000)
            return f"₹{m_inr.group(1)}L - ₹{m_inr.group(2)}L", v1, v2

    return None, None, None

async def enrich():
    print("🚀 Enriching all jobs with compensation, geo-hubs, and experience tiers...")
    async with get_db_connection() as db:
        cur = await db.execute("SELECT id, source_type, title, seniority, location, raw_json, description FROM jobs")
        jobs = await cur.fetchall()

        updated = 0
        comp_count = 0
        hub_counts = {}

        for j in jobs:
            geo_hub = detect_geo_hub(j["location"], j["title"])
            exp_tier = detect_experience_tier(j["seniority"], j["title"])
            salary_summary, min_sal, max_sal = parse_compensation(j["source_type"], j["raw_json"], j["description"])

            if salary_summary:
                comp_count += 1
            hub_counts[geo_hub] = hub_counts.get(geo_hub, 0) + 1

            await db.execute("""
                UPDATE jobs SET
                    geo_hub = ?,
                    experience_tier = ?,
                    salary_summary = ?,
                    min_salary = ?,
                    max_salary = ?
                WHERE id = ?
            """, (geo_hub, exp_tier, salary_summary, min_sal, max_sal, j["id"]))
            updated += 1

        await db.commit()
        print(f"✅ Enriched {updated} jobs successfully!")
        print(f"💰 Jobs with verified salary tiers: {comp_count}")
        print("\n📍 Geographic Hub Distribution:")
        for hub, cnt in sorted(hub_counts.items(), key=lambda x: -x[1]):
            print(f"  {hub:<12}: {cnt}")

if __name__ == "__main__":
    asyncio.run(enrich())
