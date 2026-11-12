"""Daily job email: matching and rendering (scripts/send_digest.py), with the job data stubbed."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("send_digest", Path(__file__).resolve().parents[2] / "scripts" / "send_digest.py")
sd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sd)

COLS = ["id", "company_name", "title", "normalized_role", "seniority", "work_mode", "location", "geo_hub", "salary_summary", "posted_at", "application_url"]
META = {"columns": COLS, "categories": [{"id": "product_design", "label": "Product Design"}, {"id": "qa", "label": "QA"}],
        "files": {"product_design": {"1": {"jobs": 4}}, "qa": {"1": {"jobs": 1}}, "data": {"3": {"jobs": 9}}}}
ROWS = {"product_design": [
    [1, "Acme", "Senior Product Designer", "product_design", "senior", "remote", "Remote", "global", "$150k", "2026-11-12T08:00:00Z", "https://acme.test/1"],
    [2, "Globex", "Product Designer", "product_design", "mid", "onsite", "Bengaluru", "india", None, "2026-11-12T09:00:00Z", "https://globex.test/2"],
    [3, "Initech", "Lead Designer", "product_design", "lead", "hybrid", "Pune", "india", None, "2026-11-12T07:00:00Z", "https://initech.test/3"],
    [4, "Umbrella", "Senior UX Designer <script>", "product_design", "senior", "onsite", "Berlin", "europe", None, "2026-11-12T10:00:00Z", "https://u.test/4"]],
    "qa": [[5, "Acme", "QA Engineer", "qa", "mid", "remote", "Remote", "global", None, "2026-11-12T06:00:00Z", "https://acme.test/5"]]}


def fake_get_json(url, headers=None):
    if url.endswith("/meta.json"):
        return META
    cat = url.split("/jobs/")[1].split("/")[0]
    return {"rows": ROWS[cat]}


def test_matching_and_email(monkeypatch):
    monkeypatch.setattr(sd, "get_json", fake_get_json)
    today = sd.Today()
    assert today.total == 5  # only the last-24-hours files count

    india = sd.matches(today, {"roles": ["product_design"], "hub": "india"})
    assert [j["id"] for j in india] == [2, 3]  # newest first, only India

    senior_remote = sd.matches(today, {"roles": ["product_design", "qa"], "seniority": ["senior"], "remote": True})
    assert [j["id"] for j in senior_remote] == [1]

    assert sd.matches(today, {"roles": ["data"]}) == []  # no file for today: nothing, no error

    sub = {"id": "a" * 64, "token": "b" * 48, "email": "p@x.test", "prefs": {"roles": ["product_design"], "seniority": ["senior"]}}
    found = sd.matches(today, sub["prefs"])
    subject, html_doc, text, unsub = sd.render(sub, found, today.total, today.labels)
    assert subject == "2 new jobs match you today (5 new in all)"
    assert unsub == f"https://jobly-88t.pages.dev/api/digest/unsubscribe?id={'a' * 64}&t={'b' * 48}"
    assert unsub in html_doc and unsub in text
    assert "&lt;script&gt;" in html_doc and "<script>" not in html_doc  # titles are escaped
    assert "Matching: Product Design." in html_doc and "https://acme.test/1" in html_doc
