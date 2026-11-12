# Daily job email: setup

Everything is free and uses what Jobly already has (Cloudflare Pages, GitHub Actions). No domain to buy.
Until these steps are done, the sign-up page says "being set up" and the daily workflow sends nothing.

How it works:
- **Sign-up** at `https://jobly-88t.pages.dev/daily-email`: website functions in `web/functions/api/digest/` store the
  sign-up, email a confirmation link (double opt-in), and handle one-click unsubscribe.
- **Daily send** at 03:45 UTC (09:15 India): `.github/workflows/digest.yml` runs `scripts/send_digest.py`, which reads
  the subscribers, matches today's jobs and sends one email each with Brevo.
- Brevo's free plan sends **300 emails a day**. Past that, subscribers beyond 300 get no email that day (upgrade then).

## 1. Brevo (sends the email)

1. Create a free account at brevo.com.
2. **Senders, domains and dedicated IPs → Senders → Add a sender**: use an address you can receive mail at (for
   example the support Gmail). Brevo emails it a code to verify it.
   Without your own domain, some inboxes may put the email in spam; a domain can be added later.
3. **SMTP and API → API keys → Generate a new API key**. Copy it once; you'll paste it in two places below.
4. Brevo asks for a company or sender address for its account; that's part of their sign-up.

## 2. Cloudflare (stores the list)

1. Cloudflare dashboard → **Storage and databases → Workers KV → Create a namespace**, name it `jobly-digest`.
   Copy its **Namespace ID**.
2. **Workers and Pages → jobly (the website project) → Settings → Bindings → Add → KV namespace**:
   variable name `SUBS`, namespace `jobly-digest`. Do this for **Production**.
3. Same project → **Settings → Variables and secrets**, for Production:
   - `BREVO_API_KEY`: type **Secret**, the Brevo key
   - `DIGEST_FROM`: the verified sender address from step 1.2
   - `DIGEST_FROM_NAME`: `Jobly`
4. The API token in the GitHub secret `CLOUDFLARE_API_TOKEN` needs one more permission for the daily send:
   **My Profile → API Tokens → (the token) → Edit → add Account · Workers KV Storage · Read**.

## 3. GitHub (runs the daily send)

Repository → **Settings → Secrets and variables → Actions**:
- Secret `BREVO_API_KEY`: the Brevo key
- Variable `DIGEST_KV_ID`: the KV Namespace ID from step 2.1
- Variable `DIGEST_FROM`: the verified sender address
- Variable `DIGEST_FROM_NAME` (optional): `Jobly`

## 4. Check it

1. Push (the website deploy publishes the functions). Open `/daily-email`: the form shows when step 2 is done.
2. Sign up with your own address, press the link in the confirmation email: the page says "You're in".
3. **Actions → Daily job email → Run workflow** with *dry run* ticked: the log shows how many subscribers and matches,
   without sending. Untick it to send for real.
4. Use the unsubscribe link in that email: the page says "You're unsubscribed" and the entry is gone from KV.

Tests: `node web/tests/digest.test.mjs` (sign-up functions) and `pytest backend/tests/test_send_digest.py` (matching).
