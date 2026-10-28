"""Broad job categories for every job, so Jobly can list all roles with the five tech roles highlighted.

A job's category is its tech role when it has one (product_design, frontend_engineering, fullstack_engineering,
product_management, ai_ml); otherwise the first broad category whose title pattern matches, else "other".
Computed from the title only, so it needs no database column and the same rules can run anywhere.
"""
from __future__ import annotations

import re

TECH_ROLES = ("product_design", "frontend_engineering", "fullstack_engineering", "product_management", "ai_ml")

# (id, label, title pattern). Order matters: the first match wins, so narrow families come before wide ones.
_BROAD: list[tuple[str, str, str]] = [
    ("data", "Data & Analytics",
     r"\bdata\s+(?:analyst|scientist|engineer|architect|governance|platform|science|analytics)\b|\banalytics\b|"
     r"\bbusiness\s+intelligence\b|\bbi\s+(?:developer|engineer|analyst)\b|\bstatistician\b|\bquantitative\b"),
    ("engineering", "Engineering",
     r"\bengineer(?:ing)?\b|\bdeveloper\b|\bprogrammer\b|\bdevops\b|\bsre\b|\bsite\s+reliability\b|\bqa\b|"
     r"\bquality\s+assurance\b|\btest\s+automation\b|\bsecurity\s+(?:analyst|architect|specialist)\b|\barchitect\b|"
     r"\bit\s+(?:support|administrator|specialist|manager)\b|\bsystems?\s+administrator\b|\btechnician\b|\bcto\b"),
    ("design", "Design & Creative",
     r"\bdesign(?:er)?\b|\bcreative\b|\bart\s+director\b|\billustrator\b|\bvideo\s+editor\b|\bcopywriter\b|\banimator\b"),
    ("marketing", "Marketing",
     r"\bmarketing\b|\bgrowth\b|\bseo\b|\bsem\b|\bbrand\b|\bcontent\b|\bcommunications?\b|\bsocial\s+media\b|"
     r"\bpublic\s+relations\b|\bpr\s+manager\b|\bdemand\s+gen|\bcommunity\s+manager\b|\bevents?\s+manager\b"),
    ("sales", "Sales & Business Development",
     r"\bsales\b|\baccount\s+executive\b|\bbusiness\s+development\b|\bbdr\b|\bsdr\b|\bpartnerships?\b|"
     r"\baccount\s+(?:director|manager)\b|\bpre-?sales\b|\bsolutions?\s+consultant\b|\bcommercial\b|\brevenue\b"),
    ("customer", "Customer Success & Support",
     r"\bcustomer\b|\bsupport\b|\bclient\s+(?:success|services|partner)\b|\bimplementation\b|\bonboarding\b|"
     r"\bhelp\s*desk\b|\bservice\s+desk\b|\btechnical\s+account\s+manager\b|\bcsm\b"),
    ("people", "People & Recruiting",
     r"\brecruit(?:er|ing|ment)\b|\btalent\b|\bpeople\b|\bhuman\s+resources\b|\bhr\b|\bhrbp\b|\bsourcer\b|"
     r"\bcompensation\b|\bbenefits\b|\blearning\s+(?:and|&)\s+development\b|\bpayroll\b"),
    ("finance", "Finance & Accounting",
     r"\bfinanc(?:e|ial)\b|\baccount(?:ant|ing)\b|\bcontroller\b|\btreasury\b|\btax\b|\baudit(?:or)?\b|\bfp&a\b|"
     r"\bbilling\b|\baccounts\s+(?:payable|receivable)\b|\binvestor\s+relations\b|\bcfo\b|\bactuar"),
    ("legal", "Legal & Compliance",
     r"\blegal\b|\bcounsel\b|\battorney\b|\blawyer\b|\bparalegal\b|\bcompliance\b|\bprivacy\b|\bregulatory\b|\brisk\b"),
    ("operations", "Operations",
     r"\boperations?\b|\bops\b|\blogistics\b|\bsupply\s+chain\b|\bprocurement\b|\bwarehouse\b|\bfacilities\b|"
     r"\bproject\s+manager\b|\bprogram\s+manager\b|\bchief\s+of\s+staff\b|\boffice\s+manager\b|\bexecutive\s+assistant\b|"
     r"\badministrative\b|\bstrategy\b|\bconsultant\b|\banalyst\b"),
    ("healthcare", "Healthcare & Science",
     r"\bnurse\b|\bclinical\b|\bphysician\b|\bpharmac|\bmedical\b|\btherapist\b|\bscientist\b|\bresearch\s+associate\b|"
     r"\blab(?:oratory)?\b|\bbiolog|\bchemist"),
]
_COMPILED = [(cid, label, re.compile(pat)) for cid, label, pat in _BROAD]

TECH_LABELS = {
    "product_design": "Product Design",
    "frontend_engineering": "Frontend Engineering",
    "fullstack_engineering": "Fullstack Engineering",
    "product_management": "Product Management",
    "ai_ml": "AI / ML",
}

CATEGORIES: list[dict[str, object]] = (
    [{"id": r, "label": TECH_LABELS[r], "tech": True} for r in TECH_ROLES]
    + [{"id": cid, "label": label, "tech": False} for cid, label, _ in _BROAD]
    + [{"id": "other", "label": "Other", "tech": False}]
)
CATEGORY_IDS = [c["id"] for c in CATEGORIES]


def classify_category(title: str | None, normalized_role: str | None) -> str:
    if normalized_role in TECH_LABELS:
        return normalized_role
    t = (title or "").lower()
    for cid, _label, rx in _COMPILED:
        if rx.search(t):
            return cid
    return "other"
