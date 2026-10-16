import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# High-priority candidate companies from Weekday and top tech startup lists
NEW_CANDIDATES = [
    # Top AI & Next-Gen Developer Labs
    ("Mistral AI", "mistralai", "ashby", "mistralai", "Artificial Intelligence", "https://mistral.ai/careers/"),
    ("Glean", "glean", "greenhouse", "glean", "Enterprise AI & Search", "https://www.glean.com/careers"),
    ("Harvey", "harvey", "ashby", "harvey", "Legal AI", "https://www.harvey.ai/careers"),
    ("Writer", "writer", "ashby", "writer", "Generative AI for Enterprise", "https://writer.com/careers/"),
    ("Hebbia", "hebbia", "ashby", "hebbia", "AI Neural Search", "https://www.hebbia.ai/careers"),
    ("Cognition AI", "cognition", "ashby", "cognition", "AI Applied Research (Devin)", "https://www.cognition.ai/careers"),
    ("Poolside", "poolside", "ashby", "poolside", "AI for Code Generation", "https://poolside.ai/careers"),
    ("Cresta", "cresta", "greenhouse", "cresta", "Contact Center AI", "https://cresta.com/careers/"),
    ("Shield AI", "shieldai", "greenhouse", "shieldai", "Defense & Autonomous Aerospace AI", "https://shield.ai/careers"),
    ("Anduril", "andurilindustries", "greenhouse", "andurilindustries", "Defense & Autonomous Tech", "https://www.anduril.com/careers/"),
    ("Skydio", "skydio", "greenhouse", "skydio", "Autonomous Drones & AI", "https://www.skydio.com/careers"),
    
    # Global SaaS & Cloud Leaders
    ("Snowflake", "snowflake", "greenhouse", "snowflake", "Cloud Data Warehouse", "https://careers.snowflake.com/"),
    ("Databricks", "databricks", "greenhouse", "databricks", "Data Intelligence Platform", "https://www.databricks.com/company/careers"),
    ("HashiCorp", "hashicorp", "greenhouse", "hashicorp", "Infrastructure Automation", "https://www.hashicorp.com/jobs"),
    ("Tailscale", "tailscale", "ashby", "tailscale", "Mesh VPN & Security", "https://tailscale.com/careers"),
    ("Postman", "postman", "greenhouse", "postman", "API Platform", "https://www.postman.com/company/careers/"),
    ("Sourcegraph", "sourcegraph", "greenhouse", "sourcegraph", "Code Search & AI (Cody)", "https://about.sourcegraph.com/jobs"),
    ("Prisma", "prisma", "greenhouse", "prisma", "Database ORM & Tooling", "https://www.prisma.io/careers"),
    ("Coda", "coda", "greenhouse", "coda", "Connected Document OS", "https://coda.io/careers"),
    ("Rippling", "rippling", "greenhouse", "rippling", "Workforce Management", "https://www.rippling.com/careers"),
    ("Loom", "loom", "greenhouse", "loom", "Async Video Communication", "https://www.loom.com/careers"),
    ("Pave", "pave", "ashby", "pave", "Compensation Intelligence", "https://www.pave.com/careers"),
    ("Together AI", "togetherai", "ashby", "togetherai", "Generative AI Cloud", "https://www.together.ai/careers"),
    ("Runway", "runwayml", "ashby", "runwayml", "AI Video & Creativity", "https://runwayml.com/careers"),
    ("Braintrust Data", "braintrust", "ashby", "braintrust", "AI Evaluation Platform", "https://www.braintrust.dev/careers"),
    ("Weights & Biases", "wandb", "greenhouse", "wandb", "AI Developer Platform", "https://wandb.ai/careers"),
    ("Groq", "groq", "greenhouse", "groq", "LPU AI Inference Hardware", "https://groq.com/careers/"),
    ("Hugging Face", "huggingface", "greenhouse", "huggingface", "Open Source AI", "https://huggingface.co/join-us"),

    # High-Growth Indian & Global Tech Unicorns
    ("Razorpay", "razorpay", "greenhouse", "razorpay", "Fintech & Payments", "https://razorpay.com/jobs/"),
    ("BrowserStack", "browserstack", "greenhouse", "browserstack", "Cloud Testing Platform", "https://www.browserstack.com/careers"),
    ("CleverTap", "clevertap", "greenhouse", "clevertap", "Customer Retention Cloud", "https://clevertap.com/careers/"),
    ("Hasura", "hasura", "ashby", "hasura", "GraphQL & Data APIs", "https://hasura.io/careers"),
    ("Hasura GH", "hasura", "greenhouse", "hasura", "GraphQL & Data APIs", "https://hasura.io/careers"),
    ("Urban Company", "urbancompany", "lever", "urbancompany", "Home Services Marketplace", "https://www.urbancompany.com/careers"),
    ("Dream11", "dream11", "lever", "dream11", "Sports Tech & Gaming", "https://about.dream11.in/careers"),
    ("Nykaa", "nykaa", "lever", "nykaa", "Beauty & Fashion E-Commerce", "https://www.nykaa.com/careers"),
    ("Lenskart", "lenskart", "lever", "lenskart", "Eyewear & DTC Tech", "https://www.lenskart.com/careers"),
    ("CleverTap Lever", "clevertap", "lever", "clevertap", "Customer Retention Cloud", "https://clevertap.com/careers/"),
    ("Cars24", "cars24", "lever", "cars24", "Auto E-Commerce", "https://www.cars24.com/careers/"),
    ("Unacademy", "unacademy", "lever", "unacademy", "EdTech Platform", "https://unacademy.com/careers"),
    ("Slice", "slice", "lever", "slice", "Fintech & Cards", "https://www.sliceit.com/careers"),
    ("Jupiter Money", "jupiter", "lever", "jupiter", "Neo-Banking Platform", "https://jupiter.money/careers"),
    ("Fi Money", "fi", "lever", "fi", "Digital Banking", "https://fi.money/careers"),
]

def check_candidate(cand):
    name, slug, stype, sid, industry, careers_url = cand
    url = ""
    if stype == "greenhouse":
        url = f"https://boards-api.greenhouse.io/v1/boards/{sid}/jobs?content=false"
    elif stype == "ashby":
        url = f"https://api.ashbyhq.com/posting-api/job-board/{sid}"
    elif stype == "lever":
        url = f"https://api.lever.co/v0/postings/{sid}?mode=json"

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    try:
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                jobs = data.get("jobs", []) if stype in ("greenhouse", "ashby") else (data if isinstance(data, list) else [])
                if len(jobs) > 0:
                    return cand, len(jobs)
    except Exception:
        pass
    return None

def main():
    print(f"Testing {len(NEW_CANDIDATES)} candidates in parallel...", flush=True)
    verified = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(check_candidate, c): c for c in NEW_CANDIDATES}
        for f in as_completed(futures):
            res = f.result()
            if res:
                cand, count = res
                verified.append((cand, count))
                print(f"  ✓ {cand[0]:<22} | {cand[2]:<10} | {count:>4} active openings", flush=True)

    print(f"\nFound {len(verified)} live verified candidate boards!", flush=True)

    # Load existing companies
    companies_file = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "companies.json"
    with open(companies_file, "r") as f:
        existing = json.load(f)

    existing_slugs = {c["slug"] for c in existing}
    added = 0

    for cand, count in verified:
        name, slug, stype, sid, industry, careers_url = cand
        if slug in existing_slugs:
            continue
        existing_slugs.add(slug)
        existing.append({
            "name": name,
            "slug": slug,
            "careers_url": careers_url,
            "source_type": stype,
            "source_identifier": sid,
            "industry": industry,
            "logo_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"
        })
        added += 1

    with open(companies_file, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"Added {added} new employers to {companies_file}. Total tracked: {len(existing)}")

if __name__ == "__main__":
    main()
