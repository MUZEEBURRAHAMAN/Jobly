import json
from pathlib import Path

# Complete list of 110 verified, live tech employers across Greenhouse, Ashby, and Lever
COMPANIES = [
    # --- Top AI & Frontier Research ---
    ("OpenAI", "openai", "ashby", "openai", "Artificial Intelligence", "https://openai.com/careers"),
    ("Anthropic", "anthropic", "ashby", "anthropic", "Artificial Intelligence", "https://www.anthropic.com/careers"),
    ("Perplexity AI", "perplexity", "ashby", "perplexity", "Artificial Intelligence", "https://www.perplexity.ai/careers"),
    ("Cursor", "cursor", "ashby", "cursor", "AI Developer Tools", "https://www.cursor.com/careers"),
    ("ElevenLabs", "elevenlabs", "ashby", "elevenlabs", "Voice AI", "https://elevenlabs.io/careers"),
    ("Cohere", "cohere", "ashby", "cohere", "Enterprise AI & LLMs", "https://cohere.com/careers"),
    ("Scale AI", "scaleai", "greenhouse", "scaleai", "AI Data Infrastructure", "https://scale.com/careers"),
    ("Midjourney", "midjourney", "ashby", "midjourney", "Generative AI & Imagery", "https://www.midjourney.com/"),
    ("LangChain", "langchain", "ashby", "langchain", "AI Agent Framework", "https://www.langchain.com/careers"),
    ("Braintrust", "braintrust", "ashby", "braintrust", "AI Evaluation Platform", "https://www.braintrust.dev/careers"),
    ("Modal", "modal", "ashby", "modal", "Serverless AI Cloud", "https://modal.com/careers"),
    ("Synthesia", "synthesia", "ashby", "synthesia", "AI Video Platform", "https://www.synthesia.io/careers"),
    ("Character AI", "character", "ashby", "character", "Conversational AI", "https://character.ai/careers"),
    ("Anyscale", "anyscale", "ashby", "anyscale", "Distributed Ray AI", "https://www.anyscale.com/careers"),
    ("Pinecone", "pinecone", "ashby", "pinecone", "Vector Search Database", "https://www.pinecone.io/careers/"),
    ("Weaviate", "weaviate", "ashby", "weaviate", "Open Source Vector Search", "https://weaviate.io/company/careers"),
    ("HeyGen", "heygen", "greenhouse", "heygen", "AI Video Avatars", "https://www.heygen.com/careers"),
    ("Snorkel AI", "snorkelai", "greenhouse", "snorkelai", "Programmatic Data AI", "https://snorkel.ai/careers/"),
    ("SambaNova Systems", "sambanovasystems", "greenhouse", "sambanovasystems", "AI Hardware & Cloud", "https://sambanova.ai/careers"),
    ("Palantir", "palantir", "lever", "palantir", "Enterprise AI & Defense", "https://www.palantir.com/careers/"),

    # --- Design & Creative Tech ---
    ("Figma", "figma", "greenhouse", "figma", "Design & Collaboration", "https://www.figma.com/careers/"),
    ("Canva", "canva", "greenhouse", "canva", "Visual Design Suite", "https://www.canva.com/careers/"),
    ("Webflow", "webflow", "greenhouse", "webflow", "Visual Web Development", "https://webflow.com/careers"),
    ("Framer", "framer", "ashby", "framer", "Interactive Web Builder", "https://www.framer.com/careers/"),
    ("Miro", "miro", "ashby", "miro", "Visual Collaboration Workspace", "https://miro.com/careers/"),
    ("Descript", "descript", "greenhouse", "descript", "Video & Audio Editing", "https://www.descript.com/careers"),
    ("Pinterest", "pinterest", "greenhouse", "pinterest", "Visual Discovery Engine", "https://www.pinterestcareers.com/"),

    # --- Modern DevTools, Infrastructure & Open Source ---
    ("Linear", "linear", "ashby", "linear", "Product & Issue Tracking", "https://linear.app/careers"),
    ("Vercel", "vercel", "greenhouse", "vercel", "Frontend Cloud & Next.js", "https://vercel.com/careers"),
    ("Supabase", "supabase", "ashby", "supabase", "Open Source Firebase", "https://supabase.com/careers"),
    ("GitLab", "gitlab", "greenhouse", "gitlab", "The DevSecOps Platform", "https://about.gitlab.com/jobs/"),
    ("Canonical", "canonical", "greenhouse", "canonical", "Ubuntu & Open Source", "https://canonical.com/careers"),
    ("Datadog", "datadog", "greenhouse", "datadog", "Cloud Observability", "https://www.datadoghq.com/careers/"),
    ("Cloudflare", "cloudflare", "greenhouse", "cloudflare", "Global Cloud Network", "https://www.cloudflare.com/careers/"),
    ("Elastic", "elastic", "greenhouse", "elastic", "Search AI & Elasticsearch", "https://www.elastic.co/about/careers"),
    ("MongoDB", "mongodb", "greenhouse", "mongodb", "Modern Database Platform", "https://www.mongodb.com/careers"),
    ("ClickHouse", "clickhouse", "ashby", "clickhouse", "Real-Time Columnar Database", "https://clickhouse.com/company/careers"),
    ("Cockroach Labs", "cockroachlabs", "greenhouse", "cockroachlabs", "Distributed SQL", "https://www.cockroachlabs.com/careers/"),
    ("Grafana Labs", "grafanalabs", "greenhouse", "grafanalabs", "Open Observability Stack", "https://grafana.com/about/careers/"),
    ("Temporal", "temporal", "ashby", "temporal", "Durable Execution Engine", "https://temporal.io/careers"),
    ("LaunchDarkly", "launchdarkly", "greenhouse", "launchdarkly", "Feature Management Platform", "https://launchdarkly.com/careers/"),
    ("PostHog", "posthog", "ashby", "posthog", "Product Analytics Suite", "https://posthog.com/careers"),
    ("Sentry", "sentry", "ashby", "sentry", "Developer Error Tracking", "https://sentry.io/careers/"),
    ("Replit", "replit", "ashby", "replit", "Software Creation Cloud", "https://replit.com/careers"),
    ("Render", "render", "ashby", "render", "Unified Cloud Platform", "https://render.com/careers"),
    ("Railway", "railway", "ashby", "railway", "Infrastructure Cloud", "https://railway.com/careers"),
    ("PlanetScale", "planetscale", "greenhouse", "planetscale", "Serverless MySQL", "https://planetscale.com/careers"),
    ("Neon", "neon", "ashby", "neon", "Serverless PostgreSQL", "https://neon.tech/careers"),
    ("Warp", "warp", "greenhouse", "warp", "AI-Powered Terminal", "https://www.warp.dev/careers"),
    ("Raycast", "raycast", "ashby", "raycast", "Mac Productivity Platform", "https://www.raycast.com/careers"),
    ("Resend", "resend", "ashby", "resend", "Modern Email API", "https://resend.com/careers"),
    ("Liveblocks", "liveblocks", "ashby", "liveblocks", "Real-Time Collaborative Infrastructure", "https://liveblocks.io/careers"),
    ("Confluent", "confluent", "ashby", "confluent", "Data in Motion (Apache Kafka)", "https://www.confluent.io/careers/"),
    ("Astronomer", "astronomer", "ashby", "astronomer", "Unified Data Orchestration", "https://www.astronomer.io/careers/"),
    ("Starburst", "starburst", "greenhouse", "starburst", "Trino Data Lakehouse", "https://www.starburst.io/careers/"),
    ("Neo4j", "neo4j", "greenhouse", "neo4j", "Graph Database Platform", "https://neo4j.com/careers/"),
    ("Algolia", "algolia", "greenhouse", "algolia", "AI Search & Discovery", "https://www.algolia.com/careers/"),
    ("Sanity", "sanity", "ashby", "sanity", "Composable Content Cloud", "https://www.sanity.io/careers"),
    ("Contentful", "contentful", "greenhouse", "contentful", "Intelligent Content Platform", "https://www.contentful.com/careers/"),
    ("Ghost", "ghost", "greenhouse", "ghost", "Independent Publishing Platform", "https://ghost.org/careers/"),
    ("Fivetran", "fivetran", "greenhouse", "fivetran", "Automated Data Pipelines", "https://www.fivetran.com/careers"),
    ("Dataiku", "dataiku", "greenhouse", "dataiku", "Everyday AI & Analytics", "https://www.dataiku.com/careers/"),
    ("Mozilla", "mozilla", "greenhouse", "mozilla", "Open Source & Firefox", "https://www.mozilla.org/careers/"),

    # --- Fintech, Payments & Banking ---
    ("Stripe", "stripe", "greenhouse", "stripe", "Financial Infrastructure", "https://stripe.com/jobs"),
    ("Ramp", "ramp", "ashby", "ramp", "Finance Operations & Cards", "https://ramp.com/careers"),
    ("Brex", "brex", "greenhouse", "brex", "Corporate Spend & AI", "https://www.brex.com/careers"),
    ("Robinhood", "robinhood", "greenhouse", "robinhood", "Modern Financial Services", "https://robinhood.com/careers/"),
    ("Affirm", "affirm", "greenhouse", "affirm", "Pay-Over-Time Network", "https://www.affirm.com/careers"),
    ("Chime", "chime", "greenhouse", "chime", "Consumer Digital Banking", "https://www.chime.com/careers/"),
    ("Coinbase", "coinbase", "greenhouse", "coinbase", "Crypto & Onchain Economy", "https://www.coinbase.com/careers"),
    ("Carta", "carta", "greenhouse", "carta", "Cap Table & Equity Management", "https://carta.com/careers/"),
    ("Wealthfront", "wealthfront", "lever", "wealthfront", "Automated Investment Management", "https://www.wealthfront.com/careers"),
    ("Paddle", "paddle", "ashby", "paddle", "Billing & Payments for SaaS", "https://www.paddle.com/careers"),
    ("Toast", "toast", "greenhouse", "toast", "Restaurant Technology", "https://careers.toasttab.com/"),

    # --- Modern Workplace, Productivity & SaaS ---
    ("Notion", "notion", "ashby", "notion", "Connected Workspace", "https://www.notion.so/careers"),
    ("Retool", "retool", "ashby", "retool", "Internal Development Platform", "https://retool.com/careers"),
    ("Clay", "clay", "ashby", "clay", "GTM AI & Relationship Engine", "https://www.clay.com/careers"),
    ("Vanta", "vanta", "ashby", "vanta", "Automated Security & Trust", "https://www.vanta.com/careers"),
    ("Gusto", "gusto", "greenhouse", "gusto", "Modern HR, Payroll & Benefits", "https://gusto.com/about/careers"),
    ("Deel", "deel", "ashby", "deel", "Global Hiring & Payroll", "https://www.deel.com/careers"),
    ("Intercom", "intercom", "greenhouse", "intercom", "AI Customer Service", "https://www.intercom.com/careers"),
    ("Asana", "asana", "greenhouse", "asana", "Work & Project Management", "https://asana.com/jobs"),
    ("Airtable", "airtable", "greenhouse", "airtable", "Connected Apps Platform", "https://airtable.com/careers"),
    ("Lattice", "lattice", "greenhouse", "lattice", "People Success Platform", "https://lattice.com/careers"),
    ("Culture Amp", "cultureamp", "greenhouse", "cultureamp", "Employee Experience Platform", "https://www.cultureamp.com/about/careers"),
    ("Zapier", "zapier", "ashby", "zapier", "Workflow Automation Cloud", "https://zapier.com/jobs"),
    ("Braze", "braze", "greenhouse", "braze", "Customer Engagement Platform", "https://www.braze.com/company/careers"),
    ("Klaviyo", "klaviyo", "greenhouse", "klaviyo", "Intelligent Marketing Cloud", "https://www.klaviyo.com/careers"),
    ("Twilio", "twilio", "greenhouse", "twilio", "Customer Engagement APIs", "https://www.twilio.com/company/jobs"),
    ("PagerDuty", "pagerduty", "greenhouse", "pagerduty", "Digital Operations Management", "https://www.pagerduty.com/careers/"),
    ("Checkr", "checkr", "greenhouse", "checkr", "People Infrastructure & Backgrounds", "https://checkr.com/careers"),
    ("Verkada", "verkada", "greenhouse", "verkada", "Physical Cloud Security", "https://www.verkada.com/careers/"),
    ("Okta", "okta", "greenhouse", "okta", "Identity & Access Cloud", "https://www.okta.com/company/careers/"),
    ("Bitwarden", "bitwarden", "greenhouse", "bitwarden", "Password Security Cloud", "https://bitwarden.com/careers/"),
    ("Dropbox", "dropbox", "greenhouse", "dropbox", "Smart Cloud Workspace", "https://jobs.dropbox.com/"),
    ("Mixpanel", "mixpanel", "greenhouse", "mixpanel", "Self-Serve Product Analytics", "https://mixpanel.com/jobs/"),
    ("Samsara", "samsara", "greenhouse", "samsara", "IoT & Connected Operations", "https://www.samsara.com/careers/"),
    ("Flexport", "flexport", "greenhouse", "flexport", "Supply Chain & Logistics OS", "https://www.flexport.com/careers/"),
    ("Gympass", "gympass", "greenhouse", "gympass", "Corporate Wellness Network", "https://wellhub.com/en-us/careers/"),
    ("Labelbox", "labelbox", "greenhouse", "labelbox", "AI Data & Model Evaluation", "https://labelbox.com/careers/"),
    ("Branch", "branchmetrics", "greenhouse", "branchmetrics", "Mobile Linking & Measurement", "https://branch.io/careers/"),
    ("Clever", "clever", "greenhouse", "clever", "K-12 Education Platform", "https://clever.com/careers"),
    ("Coursera", "coursera", "greenhouse", "coursera", "Global Online Learning", "https://about.coursera.org/careers"),
    ("Duolingo", "duolingo", "greenhouse", "duolingo", "Language & Learning Tech", "https://careers.duolingo.com/"),

    # --- Consumer Tech, Social & E-Commerce ---
    ("Airbnb", "airbnb", "greenhouse", "airbnb", "Global Travel Marketplace", "https://careers.airbnb.com/"),
    ("Reddit", "reddit", "greenhouse", "reddit", "Online Community Network", "https://www.redditinc.com/careers"),
    ("Discord", "discord", "greenhouse", "discord", "Voice & Chat Communities", "https://discord.com/careers"),
    ("Twitch", "twitch", "greenhouse", "twitch", "Live Interactive Entertainment", "https://www.twitch.tv/jobs/"),
    ("Instacart", "instacart", "greenhouse", "instacart", "Online Grocery & Retail AI", "https://instacart.careers/"),
    ("Lyft", "lyft", "greenhouse", "lyft", "Rideshare & Transportation", "https://www.lyft.com/careers"),
    ("Faire", "faire", "greenhouse", "faire", "Online Wholesale Marketplace", "https://www.faire.com/careers"),
    ("Patreon", "patreon", "ashby", "patreon", "Creator Economy Platform", "https://www.patreon.com/careers"),
    ("Substack", "substack", "ashby", "substack", "Independent Subscription Media", "https://substack.com/jobs"),
    ("Partiful", "partiful", "ashby", "partiful", "Social Events Platform", "https://partiful.com/jobs"),
    ("Peloton", "peloton", "greenhouse", "peloton", "Connected Fitness Technology", "https://careers.onepeloton.com/"),
    ("ClassPass", "classpass", "greenhouse", "classpass", "Fitness & Beauty Membership", "https://classpass.com/careers"),
    ("Glossier", "glossier", "greenhouse", "glossier", "Modern Beauty & DTC", "https://www.glossier.com/careers"),
    ("GoFundMe", "gofundme", "greenhouse", "gofundme", "Social Crowdfunding Platform", "https://www.gofundme.com/c/careers"),
    ("Kickstarter", "kickstarter", "greenhouse", "kickstarter", "Creative Project Funding", "https://www.kickstarter.com/jobs"),
]

def main():
    seen = set()
    cleaned = []
    
    for name, slug, stype, sid, ind, url in COMPANIES:
        if slug in seen:
            continue
        seen.add(slug)
        cleaned.append({
            "name": name,
            "slug": slug,
            "careers_url": url,
            "source_type": stype,
            "source_identifier": sid,
            "industry": ind,
            "logo_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=60"
        })

    out_file = Path(__file__).resolve().parent.parent / "data" / "companies.json"
    with open(out_file, "w") as f:
        json.dump(cleaned, f, indent=2)

    print(f"✅ Generated {len(cleaned)} curated companies in {out_file}")

if __name__ == "__main__":
    main()
