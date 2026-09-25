import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Curated list of 135 premier tech companies across Greenhouse, Ashby, and Lever
CANDIDATES = [
    # Top AI, Developer & Product Platforms (Ashby)
    ("OpenAI", "openai", "ashby", "openai", "Artificial Intelligence", "https://openai.com/careers"),
    ("Anthropic", "anthropic", "ashby", "anthropic", "Artificial Intelligence", "https://www.anthropic.com/careers"),
    ("Perplexity AI", "perplexity", "ashby", "perplexity", "Artificial Intelligence", "https://www.perplexity.ai/careers"),
    ("Cursor", "cursor", "ashby", "cursor", "AI Developer Tools", "https://www.cursor.com/careers"),
    ("Linear", "linear", "ashby", "linear", "Developer Tools", "https://linear.app/careers"),
    ("Ramp", "ramp", "ashby", "ramp", "Fintech", "https://ramp.com/careers"),
    ("Notion", "notion", "ashby", "notion", "Productivity & AI", "https://www.notion.so/careers"),
    ("Replit", "replit", "ashby", "replit", "Developer Cloud", "https://replit.com/careers"),
    ("Sentry", "sentry", "ashby", "sentry", "Developer Monitoring", "https://sentry.io/careers/"),
    ("ElevenLabs", "elevenlabs", "ashby", "elevenlabs", "Voice AI", "https://elevenlabs.io/careers"),
    ("PostHog", "posthog", "ashby", "posthog", "Product Analytics", "https://posthog.com/careers"),
    ("Retool", "retool", "ashby", "retool", "Internal Tools", "https://retool.com/careers"),
    ("Framer", "framer", "ashby", "framer", "Design & Web Builder", "https://www.framer.com/careers/"),
    ("Neon", "neon", "ashby", "neon", "Serverless Postgres", "https://neon.tech/careers"),
    ("PlanetScale", "planetscale", "ashby", "planetscale", "Database Platform", "https://planetscale.com/careers"),
    ("Together AI", "togetherai", "ashby", "togetherai", "AI Cloud Platform", "https://www.together.ai/careers"),
    ("LangChain", "langchain", "ashby", "langchain", "AI Framework", "https://www.langchain.com/careers"),
    ("Deel", "deel", "ashby", "deel", "Global HR & Payroll", "https://www.deel.com/careers"),
    ("Pave", "pave", "ashby", "pave", "Compensation Software", "https://www.pave.com/careers"),
    ("Vanta", "vanta", "ashby", "vanta", "Trust & Compliance", "https://www.vanta.com/careers"),
    ("Resend", "resend", "ashby", "resend", "Email API for Developers", "https://resend.com/careers"),
    ("Braintrust", "braintrust", "ashby", "braintrust", "AI Evaluation Platform", "https://www.braintrust.dev/careers"),
    ("Modal", "modal", "ashby", "modal", "Serverless Cloud for AI", "https://modal.com/careers"),
    ("Warp", "warp", "ashby", "warp", "Modern Terminal", "https://www.warp.dev/careers"),
    ("Raycast", "raycast", "ashby", "raycast", "Productivity Mac App", "https://www.raycast.com/careers"),
    ("Clay", "clay", "ashby", "clay", "Data & GTM Automation", "https://www.clay.com/careers"),
    ("Liveblocks", "liveblocks", "ashby", "liveblocks", "Real-Time Collaboration APIs", "https://liveblocks.io/careers"),

    # Tech Giants, DevTools & SaaS (Greenhouse)
    ("Stripe", "stripe", "greenhouse", "stripe", "Fintech & Payments", "https://stripe.com/jobs"),
    ("Figma", "figma", "greenhouse", "figma", "Design & Collaboration", "https://www.figma.com/careers/"),
    ("Airbnb", "airbnb", "greenhouse", "airbnb", "Travel & Hospitality", "https://careers.airbnb.com/"),
    ("GitLab", "gitlab", "greenhouse", "gitlab", "DevSecOps", "https://about.gitlab.com/jobs/"),
    ("Datadog", "datadog", "greenhouse", "datadog", "Cloud Observability", "https://www.datadoghq.com/careers/"),
    ("Robinhood", "robinhood", "greenhouse", "robinhood", "Fintech & Investing", "https://robinhood.com/careers/"),
    ("Pinterest", "pinterest", "greenhouse", "pinterest", "Visual Search & Social", "https://www.pinterestcareers.com/"),
    ("Canonical", "canonical", "greenhouse", "canonical", "Open Source & Ubuntu", "https://canonical.com/careers"),
    ("Discord", "discord", "greenhouse", "discord", "Social & Communications", "https://discord.com/careers"),
    ("Canva", "canva", "greenhouse", "canva", "Visual Design", "https://www.canva.com/careers/"),
    ("Webflow", "webflow", "greenhouse", "webflow", "No-Code Web Platform", "https://webflow.com/careers"),
    ("Plaid", "plaid", "greenhouse", "plaid", "Fintech APIs", "https://plaid.com/careers/"),
    ("Brex", "brex", "greenhouse", "brex", "Corporate Spend", "https://www.brex.com/careers"),
    ("Affirm", "affirm", "greenhouse", "affirm", "Buy Now Pay Later", "https://www.affirm.com/careers"),
    ("Chime", "chime", "greenhouse", "chime", "Digital Banking", "https://www.chime.com/careers/"),
    ("Gusto", "gusto", "greenhouse", "gusto", "HR & Payroll", "https://gusto.com/about/careers"),
    ("Rippling", "rippling", "greenhouse", "rippling", "Workforce Management", "https://www.rippling.com/careers"),
    ("Vercel", "vercel", "greenhouse", "vercel", "Frontend Cloud", "https://vercel.com/careers"),
    ("Supabase", "supabase", "greenhouse", "supabase", "Open Source Database", "https://supabase.com/careers"),
    ("Cloudflare", "cloudflare", "greenhouse", "cloudflare", "Cloud Network & Security", "https://www.cloudflare.com/careers/"),
    ("HashiCorp", "hashicorp", "greenhouse", "hashicorp", "Cloud Infrastructure", "https://www.hashicorp.com/jobs"),
    ("Elastic", "elastic", "greenhouse", "elastic", "Search & Observability", "https://www.elastic.co/about/careers"),
    ("MongoDB", "mongodb", "greenhouse", "mongodb", "Modern Database Platform", "https://www.mongodb.com/careers"),
    ("Cockroach Labs", "cockroachlabs", "greenhouse", "cockroachlabs", "Distributed SQL", "https://www.cockroachlabs.com/careers/"),
    ("Redis", "redis", "greenhouse", "redis", "In-Memory Real-Time Data", "https://redis.io/careers/"),
    ("ClickHouse", "clickhouse", "greenhouse", "clickhouse", "Fast Analytical Database", "https://clickhouse.com/company/careers"),
    ("dbt Labs", "dbtlabs", "greenhouse", "dbtlabs", "Analytics Engineering", "https://www.getdbt.com/careers"),
    ("Grafana Labs", "grafanalabs", "greenhouse", "grafanalabs", "Observability & Dashboards", "https://grafana.com/about/careers/"),
    ("Temporal", "temporal", "greenhouse", "temporal", "Workflow Engine", "https://temporal.io/careers"),
    ("LaunchDarkly", "launchdarkly", "greenhouse", "launchdarkly", "Feature Management", "https://launchdarkly.com/careers/"),
    ("Mixpanel", "mixpanel", "greenhouse", "mixpanel", "Product Analytics", "https://mixpanel.com/jobs/"),
    ("Sourcegraph", "sourcegraph", "greenhouse", "sourcegraph", "Code Intelligence & AI", "https://about.sourcegraph.com/jobs"),
    ("Prisma", "prisma", "greenhouse", "prisma", "Next-Gen Node ORM", "https://www.prisma.io/careers"),
    ("Render", "render", "greenhouse", "render", "Modern Cloud Platform", "https://render.com/careers"),
    ("Pulumi", "pulumi", "greenhouse", "pulumi", "Infrastructure as Code", "https://www.pulumi.com/careers/"),
    ("Grammarly", "grammarly", "greenhouse", "grammarly", "AI Communication", "https://www.grammarly.com/jobs"),
    ("Duolingo", "duolingo", "greenhouse", "duolingo", "Language Learning AI", "https://careers.duolingo.com/"),
    ("Reddit", "reddit", "greenhouse", "reddit", "Community Platform", "https://www.redditinc.com/careers"),
    ("Twitch", "twitch", "greenhouse", "twitch", "Live Streaming Media", "https://www.twitch.tv/jobs/"),
    ("DoorDash", "doordash", "greenhouse", "doordash", "Logistics & Delivery", "https://careers.doordash.com/"),
    ("Instacart", "instacart", "greenhouse", "instacart", "Grocery E-Commerce", "https://instacart.careers/"),
    ("Uber", "uber", "greenhouse", "uber", "Global Mobility", "https://www.uber.com/us/en/careers/"),
    ("Lyft", "lyft", "greenhouse", "lyft", "Transportation Network", "https://www.lyft.com/careers"),
    ("Coinbase", "coinbase", "greenhouse", "coinbase", "Crypto Economy", "https://www.coinbase.com/careers"),
    ("Kraken", "kraken", "greenhouse", "kraken", "Crypto Exchange", "https://www.kraken.com/careers"),
    ("Automattic", "automattic", "greenhouse", "automattic", "Distributed Web Publishing", "https://automattic.com/work-with-us/"),
    ("Mozilla", "mozilla", "greenhouse", "mozilla", "Open Web & Firefox", "https://www.mozilla.org/en-US/careers/"),
    ("Dropbox", "dropbox", "greenhouse", "dropbox", "Cloud Collaboration", "https://jobs.dropbox.com/"),
    ("Box", "box", "greenhouse", "box", "Cloud Content Management", "https://www.box.com/careers"),
    ("Okta", "okta", "greenhouse", "okta", "Enterprise Identity", "https://www.okta.com/company/careers/"),
    ("1Password", "1password", "greenhouse", "1password", "Password & Identity Security", "https://1password.com/careers"),
    ("Bitwarden", "bitwarden", "greenhouse", "bitwarden", "Open Source Security", "https://bitwarden.com/careers/"),
    ("Snyk", "snyk", "greenhouse", "snyk", "Developer Security", "https://snyk.io/careers/"),
    ("CrowdStrike", "crowdstrike", "greenhouse", "crowdstrike", "Cloud-Delivered Protection", "https://www.crowdstrike.com/careers/"),
    ("SentinelOne", "sentinelone", "greenhouse", "sentinelone", "Autonomous Cybersecurity", "https://www.sentinelone.com/careers/"),
    ("Intercom", "intercom", "greenhouse", "intercom", "Customer Service AI", "https://www.intercom.com/careers"),
    ("Zendesk", "zendesk", "greenhouse", "zendesk", "Customer Support Cloud", "https://jobs.zendesk.com/"),
    ("Front", "front", "greenhouse", "front", "Customer Operations", "https://front.com/careers"),
    ("Asana", "asana", "greenhouse", "asana", "Work Management Platform", "https://asana.com/jobs"),
    ("Airtable", "airtable", "greenhouse", "airtable", "Connected Apps & Database", "https://airtable.com/careers"),
    ("Coda", "coda", "greenhouse", "coda", "Collaborative Document OS", "https://coda.io/careers"),
    ("Miro", "miro", "greenhouse", "miro", "Visual Collaboration", "https://miro.com/careers/"),
    ("Loom", "loom", "greenhouse", "loom", "Video Messaging", "https://www.loom.com/careers"),
    ("Zapier", "zapier", "greenhouse", "zapier", "Automation Platform", "https://zapier.com/jobs"),
    ("Scale AI", "scaleai", "greenhouse", "scaleai", "Data Infrastructure for AI", "https://scale.com/careers"),
    ("Cohere", "cohere", "greenhouse", "cohere", "Enterprise AI & NLP", "https://cohere.com/careers"),
    ("Stability AI", "stabilityai", "greenhouse", "stabilityai", "Generative AI", "https://stability.ai/careers"),
    ("Pinecone", "pinecone", "greenhouse", "pinecone", "Vector Search for AI", "https://www.pinecone.io/careers/"),
    ("Groq", "groq", "greenhouse", "groq", "Fast AI Inference", "https://groq.com/careers/"),
    ("Deepgram", "deepgram", "greenhouse", "deepgram", "Voice AI & Speech Recognition", "https://deepgram.com/careers"),
    ("Synthesia", "synthesia", "greenhouse", "synthesia", "AI Video Platform", "https://www.synthesia.io/careers"),
    ("Docker", "docker", "greenhouse", "docker", "Containerization & Cloud", "https://www.docker.com/careers/"),
    ("Postman", "postman", "greenhouse", "postman", "API Platform", "https://www.postman.com/company/careers/"),
    ("Checkr", "checkr", "greenhouse", "checkr", "HR Technology", "https://checkr.com/careers"),
    ("GitKraken", "gitkraken", "greenhouse", "gitkraken", "Git Developer Tools", "https://www.gitkraken.com/careers"),
    ("Contentful", "contentful", "greenhouse", "contentful", "Composable Content Platform", "https://www.contentful.com/careers/"),
    ("Braze", "braze", "greenhouse", "braze", "Customer Engagement Platform", "https://www.braze.com/company/careers"),
    ("Klaviyo", "klaviyo", "greenhouse", "klaviyo", "Marketing Automation", "https://www.klaviyo.com/careers"),
    ("Twilio", "twilio", "greenhouse", "twilio", "Customer Communication Cloud", "https://www.twilio.com/company/jobs"),
    ("PagerDuty", "pagerduty", "greenhouse", "pagerduty", "Digital Operations Management", "https://www.pagerduty.com/careers/"),
    ("ServiceTitan", "servicetitan", "greenhouse", "servicetitan", "Vertical SaaS", "https://www.servicetitan.com/careers"),
    ("Toast", "toast", "greenhouse", "toast", "Restaurant Technology", "https://careers.toasttab.com/"),
    ("HubSpot", "hubspot", "greenhouse", "hubspot", "CRM & Inbound Marketing", "https://www.hubspot.com/careers"),
    ("Samsara", "samsara", "greenhouse", "samsara", "Connected Operations Cloud", "https://www.samsara.com/careers/"),
    ("GitGuardian", "gitguardian", "greenhouse", "gitguardian", "Secrets Security", "https://www.gitguardian.com/careers"),
    ("Auth0", "auth0", "greenhouse", "auth0", "Identity Platform", "https://auth0.com/careers"),
    ("Carta", "carta", "greenhouse", "carta", "Equity Management", "https://carta.com/careers/"),
    ("Marqeta", "marqeta", "greenhouse", "marqeta", "Modern Card Issuing", "https://www.marqeta.com/company/careers"),
    ("Thoughtspot", "thoughtspot", "greenhouse", "thoughtspot", "Search-Driven Analytics", "https://www.thoughtspot.com/careers"),
    ("WalkMe", "walkme", "greenhouse", "walkme", "Digital Adoption Platform", "https://www.walkme.com/careers/"),
    ("Segment", "segment", "greenhouse", "segment", "Customer Data Platform", "https://segment.com/jobs/"),
    ("Confluent", "confluent", "greenhouse", "confluent", "Data Streaming (Kafka)", "https://www.confluent.io/careers/"),
    ("Astronomer", "astronomer", "greenhouse", "astronomer", "Data Orchestration (Airflow)", "https://www.astronomer.io/careers/"),
    ("Starburst", "starburst", "greenhouse", "starburst", "Data Lake Analytics (Trino)", "https://www.starburst.io/careers/"),
    ("Snowplow", "snowplow", "greenhouse", "snowplow", "Behavioral Data Platform", "https://snowplow.io/company/careers/"),
    ("Dataiku", "dataiku", "greenhouse", "dataiku", "Everyday AI Platform", "https://www.dataiku.com/careers/"),
    ("Fivetran", "fivetran", "greenhouse", "fivetran", "Automated Data Movement", "https://www.fivetran.com/careers"),
    ("Superside", "superside", "greenhouse", "superside", "Creative & Design Services", "https://www.superside.com/careers"),
    ("ClassPass", "classpass", "greenhouse", "classpass", "Fitness & Wellness", "https://classpass.com/careers"),
    ("Eventbrite", "eventbrite", "greenhouse", "eventbrite", "Ticketing & Live Experiences", "https://www.eventbritecareers.com/"),
    ("Etsy", "etsy", "greenhouse", "etsy", "E-Commerce Marketplace", "https://careers.etsy.com/"),
    ("Warby Parker", "warbyparker", "greenhouse", "warbyparker", "Eyewear & DTC", "https://careers.warbyparker.com/"),
    ("Allbirds", "allbirds", "greenhouse", "allbirds", "Sustainable Footwear", "https://www.allbirds.com/pages/careers"),
    ("Glossier", "glossier", "greenhouse", "glossier", "Beauty & Consumer Brand", "https://www.glossier.com/careers"),
    ("Peloton", "peloton", "greenhouse", "peloton", "Connected Fitness", "https://careers.onepeloton.com/"),
    ("Faire", "faire", "greenhouse", "faire", "Wholesale Marketplace", "https://www.faire.com/careers"),
    ("Flexport", "flexport", "greenhouse", "flexport", "Global Logistics & Freight", "https://www.flexport.com/careers/"),
    ("SambaNova Systems", "sambanova", "greenhouse", "sambanovasystems", "AI Hardware & Cloud", "https://sambanova.ai/careers"),
    ("Cerebras", "cerebras", "greenhouse", "cerebras", "Wafer-Scale AI Computing", "https://cerebras.net/careers/"),
    ("Anyscale", "anyscale", "greenhouse", "anyscale", "Distributed AI Compute (Ray)", "https://www.anyscale.com/careers"),
    ("Weights & Biases", "wandb", "greenhouse", "wandb", "AI Developer Platform", "https://wandb.ai/careers"),
    ("Hugging Face", "huggingface", "greenhouse", "huggingface", "AI Open Source Community", "https://huggingface.co/join-us"),
    ("Branch", "branch", "greenhouse", "branchmetrics", "Mobile Linking Platform", "https://branch.io/careers/"),
    ("Clever", "clever", "greenhouse", "clever", "Education Technology", "https://clever.com/careers"),
    ("Coursera", "coursera", "greenhouse", "coursera", "Online Learning", "https://about.coursera.org/careers"),
    ("Quizlet", "quizlet", "greenhouse", "quizlet", "Digital Learning Tools", "https://quizlet.com/careers"),
    ("Gympass", "gympass", "greenhouse", "gympass", "Corporate Wellness", "https://wellhub.com/en-us/careers/"),
    ("Skillshare", "skillshare", "greenhouse", "skillshare", "Creative Classes", "https://www.skillshare.com/careers"),
    ("Benchling", "benchling", "greenhouse", "benchling", "Life Sciences R&D Cloud", "https://www.benchling.com/careers"),
    ("Verkada", "verkada", "greenhouse", "verkada", "Physical Security Cloud", "https://www.verkada.com/careers/"),
    ("ScalePad", "scalepad", "greenhouse", "scalepad", "MSP Software Platform", "https://scalepad.com/careers/"),
    ("FullStory", "fullstory", "greenhouse", "fullstory", "Behavioral Data Analytics", "https://www.fullstory.com/careers/"),

    # Lever
    ("Palantir", "palantir", "lever", "palantir", "Enterprise AI & Big Data", "https://www.palantir.com/careers/"),
    ("Wealthfront", "wealthfront", "lever", "wealthfront", "Fintech & Wealth Management", "https://www.wealthfront.com/careers"),
]

def check_one(candidate):
    name, slug, stype, sid, industry, careers_url = candidate
    url = ""
    if stype == "greenhouse":
        url = f"https://boards-api.greenhouse.io/v1/boards/{sid}/jobs?content=false"
    elif stype == "ashby":
        url = f"https://api.ashbyhq.com/posting-api/job-board/{sid}"
    elif stype == "lever":
        url = f"https://api.lever.co/v0/postings/{sid}?mode=json"

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
    try:
        with urllib.request.urlopen(req, timeout=3.5) as response:
            if response.status == 200:
                raw = response.read()
                data = json.loads(raw.decode("utf-8"))
                if stype in ("greenhouse", "ashby"):
                    jobs = data.get("jobs", [])
                else:
                    jobs = data if isinstance(data, list) else []
                if len(jobs) > 0:
                    return candidate, len(jobs)
    except Exception:
        pass
    return None

def main():
    print(f"Testing {len(CANDIDATES)} companies using ThreadPoolExecutor...", flush=True)
    verified = []
    
    with ThreadPoolExecutor(max_workers=30) as executor:
        future_to_c = {executor.submit(check_one, c): c for c in CANDIDATES}
        for future in as_completed(future_to_c):
            res = future.result()
            if res:
                cand, count = res
                verified.append((cand, count))
                print(f"  ✓ {cand[0]:<22} | {cand[2]:<10} | {count:>4} active jobs", flush=True)

    print(f"\n🎉 Successfully verified {len(verified)} active company boards!", flush=True)
    
    companies_json = []
    seen_slugs = set()
    total_jobs = 0

    for item, job_cnt in sorted(verified, key=lambda x: -x[1]):
        name, slug, stype, sid, industry, careers_url = item
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        total_jobs += job_cnt

        companies_json.append({
            "name": name,
            "slug": slug,
            "careers_url": careers_url,
            "source_type": stype,
            "source_identifier": sid,
            "industry": industry,
            "logo_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"
        })

    output_path = Path(__file__).resolve().parent.parent / "data" / "companies.json"
    with open(output_path, "w") as f:
        json.dump(companies_json, f, indent=2)

    print(f"\nSaved {len(companies_json)} companies to {output_path}", flush=True)
    print(f"Total live jobs across all {len(companies_json)} companies: ~{total_jobs}", flush=True)

if __name__ == "__main__":
    main()
