"""Daily job email: one email per confirmed subscriber with today's new jobs that match what they picked.

Runs once a day in GitHub Actions (.github/workflows/digest.yml). Standard library only.
  Subscribers   Cloudflare KV (keys "sub:<id>", written by web/functions/api/digest), read with the Cloudflare API
  Jobs          Jobly's public job data (jobs/<category>/1.json: jobs posted in the last 24 hours)
  Sending       Brevo's transactional email API, with a one-click unsubscribe link in every email

Environment:
  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, DIGEST_KV_ID   read the subscribers (token needs Workers KV read)
  BREVO_API_KEY, DIGEST_FROM, DIGEST_FROM_NAME                send the emails
  SITE_URL (default https://jobly-88t.pages.dev), DATA_URL (default https://jobly-data.pages.dev/v1)
  DRY_RUN=1  match and render but don't send; writes the first email to digest-preview.html
"""
from __future__ import annotations

import html
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

SITE = os.environ.get("SITE_URL", "https://jobly-88t.pages.dev").rstrip("/")
DATA = os.environ.get("DATA_URL", "https://jobly-data.pages.dev/v1").rstrip("/")
TOP = 10


def get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "jobly-digest", **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


# ---------------------------------------------------------------- subscribers
def subscribers() -> list[dict[str, Any]]:
    token, account, ns = os.environ["CLOUDFLARE_API_TOKEN"], os.environ["CLOUDFLARE_ACCOUNT_ID"], os.environ["DIGEST_KV_ID"]
    base = f"https://api.cloudflare.com/client/v4/accounts/{account}/storage/kv/namespaces/{ns}"
    auth = {"Authorization": f"Bearer {token}"}
    keys: list[str] = []
    cursor = ""
    while True:
        q = urllib.parse.urlencode({"prefix": "sub:", "limit": 1000, **({"cursor": cursor} if cursor else {})})
        page = get_json(f"{base}/keys?{q}", auth)
        keys += [k["name"] for k in page.get("result", [])]
        cursor = (page.get("result_info") or {}).get("cursor") or ""
        if not cursor:
            break
    out = []
    for k in keys:
        try:
            sub = get_json(f"{base}/values/{urllib.parse.quote(k, safe='')}", auth)
            sub["id"] = k.split(":", 1)[1]
            out.append(sub)
        except Exception as e:  # one bad record never stops the rest
            print(f"skip {k[:12]}…: {e}", file=sys.stderr)
    return out


# ---------------------------------------------------------------- jobs
class Today:
    """Today's jobs per category, fetched once each and shared by every subscriber."""

    def __init__(self) -> None:
        self.meta = get_json(f"{DATA}/meta.json")
        self.columns: list[str] = self.meta["columns"]
        self.labels = {c["id"]: c["label"] for c in self.meta.get("categories", [])}
        self.total = sum(int((f.get("1") or {}).get("jobs", 0)) for f in self.meta.get("files", {}).values())
        self._cache: dict[str, list[dict[str, Any]]] = {}

    def jobs(self, category: str) -> list[dict[str, Any]]:
        if category not in self._cache:
            if "1" not in self.meta.get("files", {}).get(category, {}):
                self._cache[category] = []
            else:
                rows = get_json(f"{DATA}/jobs/{urllib.parse.quote(category)}/1.json").get("rows", [])
                self._cache[category] = [dict(zip(self.columns, r)) for r in rows]
        return self._cache[category]


def matches(today: Today, prefs: dict[str, Any]) -> list[dict[str, Any]]:
    seniority = set(prefs.get("seniority") or [])
    hub, remote = prefs.get("hub") or "", bool(prefs.get("remote"))
    seen: set[Any] = set()
    out = []
    for role in prefs.get("roles") or []:
        for j in today.jobs(role):
            if j["id"] in seen:
                continue
            if seniority and j.get("seniority") not in seniority:
                continue
            if remote and j.get("work_mode") != "remote":
                continue
            if hub and not remote and (j.get("geo_hub") or "global") != hub:
                continue
            seen.add(j["id"])
            out.append(j)
    out.sort(key=lambda j: j.get("posted_at") or "", reverse=True)
    return out


# ---------------------------------------------------------------- email
def render(sub: dict[str, Any], found: list[dict[str, Any]], total: int, labels: dict[str, str]) -> tuple[str, str, str, str]:
    unsub = f"{SITE}/api/digest/unsubscribe?id={sub['id']}&t={sub['token']}"
    roles = ", ".join(labels.get(r, r) for r in sub["prefs"].get("roles", []))
    n = len(found)
    subject = f"{n} new job{'s' if n != 1 else ''} match you today" if n else "No new matches today"
    subject += f" ({total:,} new in all)"
    esc = html.escape
    rows = []
    for j in found[:TOP]:
        where = " · ".join(x for x in [j.get("company_name"), j.get("location"), "Remote" if j.get("work_mode") == "remote" else ""] if x)
        link = j.get("application_url") or SITE
        rows.append(f"""<tr><td style="padding:12px 0;border-bottom:1px solid #e4e4e7">
<a href="{esc(link)}" style="color:#18181b;font-weight:600;text-decoration:none;font-size:15px">{esc(j.get('title') or 'Job')}</a>
<div style="color:#52525b;font-size:13px;margin-top:2px">{esc(where)}{(' · ' + esc(j['salary_summary'])) if j.get('salary_summary') else ''}</div></td></tr>""")
    more = f'<p style="margin:16px 0 0"><a href="{SITE}" style="color:#18181b">See all {n} in Jobly</a></p>' if n > TOP else ""
    body = "".join(rows) or '<tr><td style="padding:12px 0;color:#52525b">Nothing new matched today. We will check again tomorrow.</td></tr>'
    html_doc = f"""<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
<p style="font-size:13px;color:#71717a;margin:0 0 4px">Jobly · {datetime.now(timezone.utc):%d %b %Y}</p>
<h1 style="font-size:22px;margin:0 0 4px">{n} new job{'s' if n != 1 else ''} match you today</h1>
<p style="color:#52525b;margin:0 0 12px;font-size:14px">{total:,} jobs were posted in the last 24 hours. Matching: {esc(roles)}.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">{body}</table>{more}
<p style="color:#a1a1aa;font-size:12px;margin-top:28px">You get this because you signed up for the daily Jobly email.
<a href="{unsub}" style="color:#71717a">Unsubscribe</a> in one click.</p></div>"""
    text = "\n".join([f"{n} new jobs match you today ({total:,} posted in the last 24 hours).", ""]
                     + [f"- {j.get('title')} · {j.get('company_name')} · {j.get('location') or ''}\n  {j.get('application_url') or SITE}" for j in found[:TOP]]
                     + ["", f"Unsubscribe: {unsub}"])
    return subject, html_doc, text, unsub


def send(to: str, subject: str, html_doc: str, text: str, unsub: str) -> bool:
    body = json.dumps({
        "sender": {"email": os.environ["DIGEST_FROM"], "name": os.environ.get("DIGEST_FROM_NAME") or "Jobly"},
        "to": [{"email": to}], "subject": subject, "htmlContent": html_doc, "textContent": text,
        "headers": {"List-Unsubscribe": f"<{unsub}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
    }).encode()
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=body, method="POST", headers={
        "api-key": os.environ["BREVO_API_KEY"], "content-type": "application/json", "accept": "application/json", "User-Agent": "jobly-digest"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return 200 <= r.status < 300
    except Exception as e:
        print(f"send failed: {e}", file=sys.stderr)
        return False


def main() -> int:
    dry = os.environ.get("DRY_RUN") == "1"
    today = Today()
    subs = subscribers()
    sent = skipped = failed = 0
    for i, sub in enumerate(subs):
        found = matches(today, sub.get("prefs") or {})
        if not found:  # no empty emails
            skipped += 1
            continue
        subject, html_doc, text, unsub = render(sub, found, today.total, today.labels)
        if dry:
            if sent == 0:
                open("digest-preview.html", "w", encoding="utf-8").write(html_doc)
            sent += 1
            continue
        if send(sub["email"], subject, html_doc, text, unsub):
            sent += 1
        else:
            failed += 1
        if i % 10 == 9:
            time.sleep(1)  # stay well inside Brevo's rate limit
    print(f"{len(subs)} subscribers · {sent} {'rendered' if dry else 'sent'} · {skipped} with no matches · {failed} failed · {today.total:,} jobs today")
    return 1 if failed and not sent else 0


if __name__ == "__main__":
    sys.exit(main())
