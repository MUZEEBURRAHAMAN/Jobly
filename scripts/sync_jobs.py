import asyncio
import sys
import time
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_path))

from backend.app.db import init_db
from backend.app.ingestion.runner import sync_all_sources

async def main():
    print("🚀 Starting Hiring Radar ATS sync...")
    start_time = time.time()
    await init_db()

    summary = await sync_all_sources()
    elapsed = time.time() - start_time

    print("\n" + "=" * 50)
    print("🎯 SYNC SUMMARY")
    print("=" * 50)
    print(f"Companies checked : {summary['companies_checked']}")
    print(f"Total jobs fetched: {summary['jobs_fetched']}")
    print(f"New jobs added    : {summary['new_jobs']}")
    print(f"Jobs updated      : {summary['updated_jobs']}")
    print(f"Duration          : {elapsed:.2f}s")
    if summary["errors"]:
        print("\n⚠️ Errors encountered:")
        for err in summary["errors"]:
            source_name = err.get("company") or err.get("source", "Unknown")
            print(f"  - {source_name}: {err['error']}")
    print("=" * 50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())
