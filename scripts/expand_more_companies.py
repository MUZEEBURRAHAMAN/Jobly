"""
Verified ATS company discovery script.
Tests candidate companies against Greenhouse, Ashby, and Lever public APIs.
Adds all confirmed companies with > 0 jobs to backend/app/data/companies.json and SQLite DB.
"""
import asyncio
import json
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Large list of candidate tech companies, AI labs, fintech, devtools, design-led companies
CANDIDATE_POOLS = [
    # --- AI & Research Labs ---
    ("Mistral AI", "mistralai", "ashby", "mistralai", "Artificial Intelligence", "https://mistral.ai/careers"),
    ("Cohere", "cohere", "ashby", "cohere", "Artificial Intelligence", "https://cohere.com/careers"),
    ("Replicate", "replicate", "ashby", "replicate", "AI Cloud Infrastructure", "https://replicate.com/careers"),
    ("Poolside", "poolside", "ashby", "poolside", "AI for Code Generation", "https://poolside.ai/careers"),
    ("Cognition AI", "cognition", "ashby", "cognition", "AI Applied Research", "https://www.cognition.ai/careers"),
    ("Hebbia", "hebbia", "ashby", "hebbia", "Enterprise AI Search", "https://www.hebbia.ai/careers"),
    ("Writer", "writer", "ashby", "writer", "Generative AI", "https://writer.com/careers"),
    ("Harvey", "harvey", "ashby", "harvey", "Legal AI", "https://www.harvey.ai/careers"),
    ("Together AI", "togetherai", "ashby", "togetherai", "AI Cloud Platform", "https://www.together.ai/careers"),
    ("Runway", "runwayml", "ashby", "runwayml", "AI Video & Creativity", "https://runwayml.com/careers"),
    ("Scale AI", "scaleai", "greenhouse", "scaleai", "AI Data & Infrastructure", "https://scale.com/careers"),
    ("Hugging Face", "huggingface", "greenhouse", "huggingface", "Open Source AI", "https://huggingface.co/join-us"),
    ("Weights & Biases", "wandb", "greenhouse", "wandb", "AI Developer Platform", "https://wandb.ai/careers"),
    ("Groq", "groq", "greenhouse", "groq", "LPU AI Hardware", "https://groq.com/careers"),
    ("Glean", "glean", "greenhouse", "glean", "Enterprise Search AI", "https://www.glean.com/careers"),
    ("Cresta", "cresta", "greenhouse", "cresta", "Contact Center AI", "https://cresta.com/careers"),
    ("Shield AI", "shieldai", "greenhouse", "shieldai", "Aerospace & Defense AI", "https://shield.ai/careers"),
    ("Anduril Industries", "andurilindustries", "greenhouse", "andurilindustries", "Defense Tech & Hardware", "https://www.anduril.com/careers"),
    ("Skydio", "skydio", "greenhouse", "skydio", "Autonomous Drones", "https://www.skydio.com/careers"),

    # --- Modern DevTools, Infrastructure & Cloud ---
    ("Tailscale", "tailscale", "ashby", "tailscale", "Mesh VPN & Security", "https://tailscale.com/careers"),
    ("Railway", "railway", "ashby", "railway", "Cloud Infrastructure", "https://railway.com/careers"),
    ("Fly.io", "fly", "ashby", "fly", "Global App Platform", "https://fly.io/jobs"),
    ("Speckle", "speckle", "ashby", "speckle", "3D Data Infrastructure", "https://speckle.systems/careers"),
    ("Incident.io", "incident-io", "ashby", "incident-io", "Incident Management", "https://incident.io/careers"),
    ("Honeycomb", "honeycomb", "greenhouse", "honeycomb", "Observability & Tracing", "https://www.honeycomb.io/careers"),
    ("GitBook", "gitbook", "ashby", "gitbook", "Documentation Platform", "https://jobs.gitbook.com"),
    ("Netlify", "netlify", "greenhouse", "netlify", "Web Architecture & Serverless", "https://www.netlify.com/careers"),
    ("Postman", "postman", "greenhouse", "postman", "API Platform", "https://www.postman.com/company/careers"),
    ("Sourcegraph", "sourcegraph", "greenhouse", "sourcegraph", "Code Intelligence & AI", "https://about.sourcegraph.com/jobs"),
    ("Prisma", "prisma", "greenhouse", "prisma", "Next-Gen Node ORM", "https://www.prisma.io/careers"),
    ("Coda", "coda", "greenhouse", "coda", "Collaborative Document OS", "https://coda.io/careers"),
    ("Zapier", "zapier", "greenhouse", "zapier", "Workflow Automation", "https://zapier.com/jobs"),
    ("Automattic", "automattic", "greenhouse", "automattic", "Open Web & WordPress", "https://automattic.com/work-with-us"),
    ("DuckDuckGo", "duckduckgo", "greenhouse", "duckduckgo", "Privacy & Search Engine", "https://duckduckgo.com/hiring"),
    ("Airtable", "airtable", "greenhouse", "airtable", "Connected Apps & Database", "https://airtable.com/careers"),
    ("Asana", "asana", "greenhouse", "asana", "Work Management Platform", "https://asana.com/jobs"),
    ("Miro", "miro", "lever", "miro", "Visual Collaboration Workspace", "https://miro.com/careers"),
    ("Coinbase", "coinbase", "greenhouse", "coinbase", "Crypto & Web3 Platform", "https://www.coinbase.com/careers"),
    ("Kraken", "kraken", "greenhouse", "kraken", "Crypto Exchange", "https://www.kraken.com/careers"),
    ("Alchemy", "alchemy", "greenhouse", "alchemy", "Web3 Developer Infrastructure", "https://www.alchemy.com/careers"),
    ("OpenSea", "opensea", "greenhouse", "opensea", "Digital Marketplace", "https://opensea.io/careers"),
    ("Chainalysis", "chainalysis", "greenhouse", "chainalysis", "Blockchain Intelligence", "https://www.chainalysis.com/careers"),

    # --- Design-Driven & Consumer Tech ---
    ("Pitch", "pitch", "ashby", "pitch", "Collaborative Presentations", "https://pitch.com/jobs"),
    ("LottieFiles", "lottiefiles", "ashby", "lottiefiles", "Motion Design Platform", "https://lottiefiles.com/careers"),
    ("Yelp", "yelp", "lever", "yelp", "Local Reviews & Discovery", "https://www.yelp.careers"),
    ("Coursera", "coursera", "lever", "coursera", "Online Learning", "https://about.coursera.org/careers"),
    ("Udemy", "udemy", "lever", "udemy", "Online Skills Marketplace", "https://about.udemy.com/careers"),
    ("Medium", "medium", "lever", "medium", "Publishing & Writing Platform", "https://medium.com/jobs-at-medium"),
    ("Eventbrite", "eventbrite", "lever", "eventbrite", "Live Experiences & Ticketing", "https://www.eventbritecareers.com"),
    ("DigitalOcean", "digitalocean", "lever", "digitalocean", "Cloud Hosting for Developers", "https://www.digitalocean.com/careers"),
    ("Carta", "carta", "greenhouse", "carta", "Equity & Ownership Management", "https://carta.com/careers"),
    ("Monzo", "monzo", "greenhouse", "monzo", "Digital Banking", "https://monzo.com/careers"),
    ("Revolut", "revolut", "lever", "revolut", "Global Financial Superapp", "https://www.revolut.com/careers"),
    ("N26", "n26", "greenhouse", "n26", "Mobile Banking", "https://n26.com/en-eu/careers"),
    ("Wise", "wise", "greenhouse", "wise", "Cross-Border Money Transfer", "https://wise.jobs"),
    ("Checkout.com", "checkout", "greenhouse", "checkout", "Connected Payments", "https://www.checkout.com/careers"),
    ("SumUp", "sumup", "greenhouse", "sumup", "Merchant Payments & POS", "https://www.sumup.com/careers"),
    ("Intercom", "intercom", "greenhouse", "intercom", "AI Customer Service Platform", "https://www.intercom.com/careers"),
    ("Front", "front", "greenhouse", "front", "Customer Communication Hub", "https://front.com/careers"),
    ("Braze", "braze", "greenhouse", "braze", "Customer Engagement Platform", "https://www.braze.com/company/careers"),
    ("Amplitude", "amplitude", "greenhouse", "amplitude", "Digital Analytics Platform", "https://amplitude.com/careers"),
    ("Kustomer", "kustomer", "greenhouse", "kustomer", "Omnichannel CRM", "https://www.kustomer.com/careers"),
    ("Gong", "gong", "greenhouse", "gong", "Revenue Intelligence", "https://www.gong.io/careers"),

    # --- High-Growth Indian & APAC Unicorns ---
    ("Razorpay", "razorpay", "greenhouse", "razorpay", "Fintech & Payments", "https://razorpay.com/jobs"),
    ("BrowserStack", "browserstack", "greenhouse", "browserstack", "Cloud Testing Platform", "https://www.browserstack.com/careers"),
    ("CleverTap", "clevertap", "greenhouse", "clevertap", "Customer Retention Cloud", "https://clevertap.com/careers"),
    ("Hasura", "hasura", "greenhouse", "hasura", "GraphQL & Data APIs", "https://hasura.io/careers"),
    ("Urban Company", "urbancompany", "lever", "urbancompany", "Home Services Marketplace", "https://www.urbancompany.com/careers"),
    ("Dream11", "dream11", "lever", "dream11", "Sports Tech & Gaming", "https://about.dream11.in/careers"),
    ("Nykaa", "nykaa", "lever", "nykaa", "Beauty & Fashion E-Commerce", "https://www.nykaa.com/careers"),
    ("Lenskart", "lenskart", "lever", "lenskart", "Eyewear & DTC Tech", "https://www.lenskart.com/careers"),
    ("Cars24", "cars24", "lever", "cars24", "Auto E-Commerce", "https://www.cars24.com/careers"),
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
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                jobs = data.get("jobs", []) if stype in ("greenhouse", "ashby") else (data if isinstance(data, list) else [])
                if len(jobs) > 0:
                    return cand, len(jobs)
    except Exception:
        pass
    return None


def run():
    print(f"Testing {len(CANDIDATE_POOLS)} candidates across Greenhouse, Ashby, and Lever in parallel...", flush=True)
    verified = []
    with ThreadPoolExecutor(max_workers=25) as executor:
        futures = {executor.submit(check_candidate, c): c for c in CANDIDATE_POOLS}
        for f in as_completed(futures):
            res = f.result()
            if res:
                cand, count = res
                verified.append((cand, count))
                print(f"  ✓ {cand[0]:<22} | {cand[2]:<10} | {count:>4} active jobs", flush=True)

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
            "logo_url": f"https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url={careers_url}&size=128"
        })
        added += 1

    with open(companies_file, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"Added {added} new employers to {companies_file}. Total tracked: {len(existing)}")


if __name__ == "__main__":
    run()
