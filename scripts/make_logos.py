import json
from pathlib import Path

with open('data/companies.json') as f:
    comps = json.load(f)

domains = {}
for c in comps:
    url = c.get('careers_url', '')
    name = c['name'].lower().strip()
    slug = c['slug'].lower().strip()
    if '//' in url:
        d = url.split('//')[1].split('/')[0].replace('www.', '')
        domains[name] = d
        domains[slug] = d

overrides = {
    'amazon': 'amazon.com',
    'salesforce': 'salesforce.com',
    'nvidia': 'nvidia.com',
    'adobe': 'adobe.com',
    'stripe': 'stripe.com',
    'figma': 'figma.com',
    'linear': 'linear.app',
    'notion': 'notion.so',
    'paytm': 'paytm.com',
    'razorpay': 'razorpay.com',
    'cred': 'cred.club',
    'meesho': 'meesho.com',
    'swiggy': 'swiggy.com',
    'zomato': 'zomato.com',
    'flipkart': 'flipkart.com',
    'uber': 'uber.com',
    'lyft': 'lyft.com',
    'airbnb': 'airbnb.com',
    'coinbase': 'coinbase.com',
    'robinhood': 'robinhood.com',
    'plaid': 'plaid.com',
    'brex': 'brex.com',
    'ramp': 'ramp.com',
    'rippling': 'rippling.com',
    'deel': 'deel.com',
    'databricks': 'databricks.com',
    'snowflake': 'snowflake.com',
    'snowflake computing': 'snowflake.com',
    'cloudflare': 'cloudflare.com',
    'vercel': 'vercel.com',
    'supabase': 'supabase.com',
    'openai': 'openai.com',
    'anthropic': 'anthropic.com',
    'perplexity': 'perplexity.ai',
    'perplexity ai': 'perplexity.ai',
    'cursor': 'cursor.com',
    'harvey': 'harvey.ai',
    'cresta': 'cresta.com',
    'gusto': 'gusto.com'
}
domains.update(overrides)

output_code = '// Official domains mapping for 140+ companies to fetch real company website logos like Weekdays\n'
output_code += 'export const COMPANY_DOMAINS: Record<string, string> = ' + json.dumps(domains, indent=2) + ';\n\n'
output_code += '''export const getCompanyLogoUrl = (companyName: string, careersUrl?: string): string => {
  if (careersUrl && careersUrl.includes('://')) {
    try {
      const u = new URL(careersUrl);
      const host = u.hostname.replace(/^www\\./, '');
      if (host && !host.includes('greenhouse') && !host.includes('lever') && !host.includes('ashbyhq') && !host.includes('myworkdayjobs')) {
        return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${host}&size=128`;
      }
    } catch {
      // Ignore URL parse error
    }
  }

  const clean = companyName.toLowerCase().trim();
  const stripped = clean.replace(/\\s+(inc|corp|technologies|tech|ai|labs|software|solutions|services)\\.?$/i, '').trim();
  const domain = COMPANY_DOMAINS[clean] || COMPANY_DOMAINS[stripped] || `${clean.replace(/[^a-z0-9]/g, '')}.com`;
  return `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`;
};
'''

with open('extension/src/lib/companyLogos.ts', 'w') as f:
    f.write(output_code)

print('Generated companyLogos.ts with', len(domains), 'domains')
