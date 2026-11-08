from __future__ import annotations
import re
from typing import Any

ROLE_TAXONOMY = {
    "product_design": {
        "label": "Product Design",
        "include": [
            r"\bproduct\s+design(?:er|ing)?\b",
            r"\b(?:ui\s*[\/\-]\s*ux|ux\s*[\/\-]\s*ui)\b",
            r"\bux\s+design(?:er)?\b",
            r"\buser\s+experience\s+design(?:er)?\b",
            r"\binteraction\s+design(?:er)?\b",
            r"\bdesign\s+systems?\b",
            r"\bdesign\s+engineer\b",
            r"\bdesign\s+technologist\b",
            r"\bvisual\s+designer\b",
            r"\bbrand\s+designer\b",
            r"\bui\s+designer\b",
            r"\bweb\s+designer\b",
            r"\b(?:ux|user)\s+research(?:er)?\b",
            # Design leadership and the rest of the product design family
            r"\b(?:head|director|vp|vice\s+president)\s+of\s+(?:product\s+|ux\s+|user\s+experience\s+)?design\b",
            r"\b(?:product\s+|ux\s+)?design\s+(?:manager|director|lead|leader)\b",
            r"\bchief\s+design\s+officer\b",
            r"\bux\s+(?:lead|manager|director|architect|strategist|engineer)\b",
            r"\bux\s+writ(?:er|ing)\b",
            r"\bcontent\s+design(?:er)?\b",
            r"\bservice\s+design(?:er)?\b",
            r"\bdesign\s*ops\b",
            r"\bdesign\s+(?:operations|program\s+manager)\b",
        ],
        "exclude": [
            r"\bfashion\s+design\b",
            r"\bconstruction\b",
            r"\barchitectur(?:e|al)\b",
            r"\bcivil\b",
            r"\blandscape\b",
            r"\binterior\s+design\b",
            r"\binstructional\s+design\b",
            r"\bhardware\b",
            r"\bmask\s+design\b",
            r"\bphysical\s+design\b",
            r"\brtl\s+design\b",
            r"\belectrical\b",
            r"\bsilicon\b",
            r"\bdata\s+center\s+design\b",
            r"\bactuator\b",
            r"\banalog\b",
            r"\bmechanical\b",
            r"\basic\b",
            r"\bfpga\b",
            # Engineers who build design systems or UI kits are engineers, not designers.
            r"\bsoftware\s+(?:engineer|developer)\b",
            r"\b(?:android|ios|mobile|backend|back-end|full[\s-]?stack|devops|platform|infrastructure)\s+(?:engineer|developer)\b",
            r"\b(?:developer|programmer)\b",
        ]
    },
    "frontend_engineering": {
        "label": "Frontend Engineering",
        "include": [
            r"\bfront\s*[-]?\s*end\b",
            r"\bfrontend\b",
            r"\breact(?:\.js)?\b",
            r"\bui\s+engineer\b",
            r"\bweb\s+(?:engineer|developer|platform)\b",
            r"\bsoftware\s+engineer[,\s\-]+(?:frontend|front-end|web|ui|client)\b",
            r"\bdesign\s+engineer\s*[\(\-]?\s*(?:web|ui|frontend|product|brand)\b",
            r"\bclient\s+(?:platform\s+)?engineer\b",
            r"\bjavascript\b",
            r"\btypescript\b",
            r"\b(?:angular(?:js)?|vue(?:\.js|js)?|svelte|next\.js|nextjs)\s+(?:engineer|developer|dev)\b"
        ],
        "exclude": [
            r"\bbackend\s+(?:engineer|developer)\b",
            r"\bback\s*[-]?\s*end\b",
            r"\bqa\s+(?:engineer|lead)\b",
            r"\bsecurity\s+engineer\b",
            r"\bdata\s+engineer\b",
            r"\bhardware\b",
            r"\belectrical\b",
            r"\bmechanical\b",
            r"\bphysical\s+design\b",
            r"\brtl\b",
            r"\bsilicon\b",
            r"\bactuator\b",
            # "Full-stack (React / TypeScript)" is a fullstack job that happens to name frontend tools.
            r"\bfull\s*[-]?\s*stack\b",
            r"\bfullstack\b",
            r"\breact\s+native\b"
        ]
    },
    "product_management": {
        "label": "Product Management",
        "include": [
            r"\bproduct\s+manager\b",
            r"\btechnical\s+product\s+manager\b",
            r"\bgroup\s+product\s+manager\b",
            r"\bassociate\s+product\s+manager\b",
            r"\bhead\s+of\s+product\b",
            r"\bdirector\s+of\s+product\b",
            r"\bprincipal\s+product\s+manager\b",
            r"\bproduct\s+lead\b",
            r"\bproduct\s+owner\b"
        ],
        "exclude": [
            r"\bproject\s+manager\b",
            r"\bprogram\s+manager\b",
            r"\bscrum\s+master\b",
            r"\bproduct\s+marketing\s+manager\b"
        ]
    },
    "ai_ml": {
        "label": "AI & Machine Learning",
        "include": [
            r"\bmachine\s+learning\b",
            r"\bml\s+(?:engineer|scientist|researcher)\b",
            r"\bai\s+(?:engineer|researcher|scientist|specialist)\b",
            r"\bapplied\s+ai\b",
            r"\bllm\b",
            r"\bapplied\s+scientist\b",
            r"\bresearch\s+scientist\b",
            r"\bdeep\s+learning\b",
            r"\bnlp\b",
            r"\bcomputer\s+vision\b"
        ],
        "exclude": [
            r"\bdata\s+entry\b"
        ]
    },
    "fullstack_engineering": {
        "label": "Fullstack Engineering",
        "include": [
            r"\bfull\s*[-]?\s*stack\b",
            r"\bfullstack\b",
            r"\bsoftware\s+engineer\b",
            r"\bsoftware\s+developer\b",
            r"\bproduct\s+engineer\b",
            r"\bsoftware\s+development\s+engineer\b",
            r"\bsde(?:\s*[-]?\s*[1-3]|[-]?ii|[-]?iii)?\b"
        ],
        "exclude": [
            r"\bqa\s+engineer\b",
            r"\btest\s+engineer\b"
        ]
    }
}

# Job boards file jobs under broad categories (a "design" feed also carries sales and ops jobs), so a board's
# category is only trusted when the title itself says engineer/developer and the category is an engineering one.
_ENGINEERING_TITLE = re.compile(r"\b(?:engineer|developer|programmer)\b")
_ENGINEERING_ROLES = {"frontend_engineering", "fullstack_engineering"}


def classify_role(title: str, hint: str | None = None) -> str | None:
    """The role for a job: from its title, else from the source's category when the title fits it."""
    role = detect_role(title)
    if role or not hint:
        return role
    if hint in _ENGINEERING_ROLES and _ENGINEERING_TITLE.search(title.lower()):
        excluded = any(re.search(exc, title.lower()) for exc in ROLE_TAXONOMY[hint]["exclude"])
        return None if excluded else hint
    return None


# Chip, memory, RF, PCB, mechanical, aerospace and building design jobs say "Design Engineer", "Design Lead" or "Design
# Manager" too. They go to Engineering unless the title also names product design work ("Digital Product Designer",
# "Senior Manager (IC), Product Designer", "Design Engineer - Design System & Platform UI").
ENGINEERING_DESIGN = re.compile(
    r"\b(?:ic|asic|rtl|rtl2gds|soc|chip|cpu|gpu|vlsi|semiconductor|silicon|dram|sram|nand|hbm|lpddr|ddr\d?|tcam|memory|"
    r"circuits?|layout|mask|analog|mixed[\s-]?signal|dft|sta|synthesis|timing|pcba?|ecad|firmware|embedded|rf|rfic|mmic|"
    r"microwave|antenna|optical|optoelectronic|photonics|packag(?:e|ing)|serdes|pcie|i/o|io|ip|ssd|datapath|logic(?:al)?|"
    r"emulation|palladium|board|electronics?|electronic|electromechanical|electromagnetic|emc|electrical|hardware|"
    r"verification|mechanical|thermal|turbines?|hydro|hvac|mep|piping|chiller|fire|suppression|plumbing|"
    r"propulsion|aerostructures?|structur(?:al|es?)|airframe|aviation|aerospace|vehicles?|engines?|combustion|fuel|"
    r"nuclear|cryogenics?|hypersonic|flowpath|bearing|satellites?|launch|transformer|switchgear|voltage|hvdc|scada|bms|"
    r"controls?|motor|tool(?:ing)?|harness|wire|cabl(?:e|ing)|composites?|cad|catia|softgoods|manufacturing|factory|"
    r"plant|process|rack|facilities|data\s+center|white\s+space|elv|ict|network|infrastructure|repair|test)\b"
    r"|\bdesign\s+engineering\b|\bengineering\s+design\b"
    r"|\bdigital\s+(?:circuit\s+)?design\s+(?:engineer|lead|manager)\b")
PRODUCT_DESIGN_WORK = re.compile(
    r"\bproduct\s+design(?:er)?\b(?!\s+engineer)|\bux\b|\bui\b|\buser\s+(?:experience|interface|research)|\binteraction\b|"
    r"\bvisual\s+design|\bbrand\s+design|\bdesign\s+systems?\b|\bweb\s+design")


# Physical spaces, objects and other fields: Design & Creative, not product design (unless the title names UX/product work)
OTHER_DESIGN = re.compile(
    r"\b(?:industrial|retail|interior|fashion|lounge|cafes?|store|restaurant|hotel|exhibition|set|costume|jewel(?:le)?ry|"
    r"furniture|ffe|drug|medicinal|clinical|learning|curriculum|deal|game|level|sound|lighting)\b")


def is_other_design(title: str) -> bool:
    t = title.lower()
    return bool(OTHER_DESIGN.search(t)) and not PRODUCT_DESIGN_WORK.search(t)


def is_engineering_design(title: str) -> bool:
    t = title.lower()
    return bool(ENGINEERING_DESIGN.search(t)) and not PRODUCT_DESIGN_WORK.search(t)


def detect_role(title: str) -> str | None:
    title_lower = title.lower()
    hardware = is_engineering_design(title_lower)
    
    # Priority order: specialized roles first before general fullstack/software engineer
    priority_order = [
        "product_design",
        "frontend_engineering",
        "ai_ml",
        "product_management",
        "fullstack_engineering"
    ]

    for role_id in priority_order:
        rules = ROLE_TAXONOMY[role_id]
        # "RF Front End Design Engineer" is hardware too, not frontend
        if role_id == "product_design" and is_other_design(title_lower):
            continue
        if hardware and (role_id == "product_design" or (role_id == "frontend_engineering" and "design" in title_lower)):
            continue
        
        # Check exclusions first
        excluded = False
        for exc in rules["exclude"]:
            if re.search(exc, title_lower):
                excluded = True
                break
        if excluded:
            continue

        # Check inclusions
        for inc in rules["include"]:
            if re.search(inc, title_lower):
                return role_id

    return None

def detect_seniority(title: str) -> str:
    title_lower = title.lower()
    if re.search(r"\b(?:intern|internship|co-op)\b", title_lower):
        return "intern"
    if re.search(r"\b(?:junior|jr\.?|associate|entry\s*level|new\s*grad|graduate|trainee|apprentice)\b", title_lower):
        return "junior"
    if re.search(r"\b(?:staff|principal|lead|founding|head\s+of|director|architect|manager|vp|svp|evp|vice\s+president|chief|cto|cdo|cpo|cio|ciso)\b", title_lower):
        return "lead"
    if re.search(r"\b(?:senior|sr\.?|iii|experienced)\b", title_lower):
        return "senior"
    return "mid"

def detect_work_mode(location: str | None, title: str) -> str:
    combined = f"{title} {location or ''}".lower()
    if re.search(r"\b(?:remote|anywhere|distributed|virtual|work\s*from\s*home|wfh)\b", combined):
        return "remote"
    if re.search(r"\b(?:hybrid)\b", combined):
        return "hybrid"
    return "on-site"

EMPLOYMENT_TYPES = ("full_time", "part_time", "contract", "internship")
_ASHBY_EMPLOYMENT = {"fulltime": "full_time", "parttime": "part_time", "intern": "internship", "contract": "contract", "temporary": "contract"}


# Clear statements in a job description: "This is a 6-month contract role", "Employment type: Freelance",
# "contract-to-hire". Not "work with contractors" or "contract negotiation".
_DESC_TYPE = [
    ("internship", re.compile(r"\b(?:employment|job|position|work|contract)\s*type\s*[:\-]?\s*intern", re.I)),
    ("contract", re.compile(r"\b(?:employment|job|position|work)\s*type\s*[:\-]?\s*(?:contract|contractor|freelance|temporary|temp|fixed[- ]term)\b", re.I)),
    ("contract", re.compile(r"\bcontract[- ]to[- ](?:hire|perm)\b", re.I)),
    ("contract", re.compile(r"\b(?:this\s+(?:is|will\s+be)\s+an?|an?)\s+(?:\d{1,2}[- ]?(?:month|week)s?\s+|short[- ]term\s+|long[- ]term\s+|paid\s+)?(?:contract|freelance|fixed[- ]term|temporary)\s+(?:role|position|job|opportunity|engagement|assignment|basis|contract)\b", re.I)),
    ("contract", re.compile(r"\b\d{1,2}[- ]?(?:month|week)s?\s+(?:contract|engagement|assignment)\b", re.I)),
    ("contract", re.compile(r"\b(?:on\s+a\s+)?freelance\s+basis\b", re.I)),
    ("part_time", re.compile(r"\b(?:employment|job|position|work)\s*type\s*[:\-]?\s*part[- ]?time\b", re.I)),
    ("part_time", re.compile(r"\bthis\s+(?:is|will\s+be)\s+a\s+part[- ]time\s+(?:role|position|job)\b", re.I)),
]


def employment_from_description(text: str | None) -> str | None:
    """The job type a description states plainly, or None. Reads the first 6,000 characters (where it is said)."""
    if not text:
        return None
    head = re.sub(r"<[^>]+>", " ", text[:12000])[:6000]
    for kind, rx in _DESC_TYPE:
        if rx.search(head):
            return kind
    return None


def classify_employment(title: str | None, raw: dict[str, Any] | None = None, description: str | None = None) -> str | None:
    """full_time, part_time, contract or internship, from the board's own field when it has one, else the title,
    else a plain statement in the description. None means the posting doesn't say (treated as full time)."""
    raw = raw or {}
    board = str(raw.get("employmentType") or raw.get("commitment") or raw.get("employment_type") or "").lower().replace("-", "").replace(" ", "")
    if board:
        if board in _ASHBY_EMPLOYMENT:
            return _ASHBY_EMPLOYMENT[board]
        if "intern" in board:
            return "internship"
        if "part" in board:
            return "part_time"
        if any(w in board for w in ("contract", "freelance", "temporary", "temp")):
            return "contract"
        if "full" in board:
            return "full_time"
    t = (title or "").lower()
    if re.search(r"\bintern(ship)?s?\b|\bco-?op\b|\bwerkstudent", t):
        return "internship"
    if re.search(r"\b(contract|contractor|freelance|freelancer|temporary|temp)\b", t):
        return "contract"
    if re.search(r"\bpart[- ]time\b", t):
        return "part_time"
    return employment_from_description(description)


def matches_preferences(job: dict[str, Any], preferences: dict[str, Any]) -> bool:
    pref_roles = preferences.get("roles", [])
    if pref_roles:
        if job.get("normalized_role") not in pref_roles:
            return False

    pref_seniorities = preferences.get("seniorities", [])
    if pref_seniorities:
        job_seniority = job.get("seniority") or "mid"
        if job_seniority not in pref_seniorities:
            return False

    if preferences.get("remote_only"):
        if job.get("work_mode") != "remote":
            return False

    pref_locations = preferences.get("locations", [])
    if pref_locations:
        loc = (job.get("location") or "").lower()
        matched_loc = any(pl.lower() in loc for pl in pref_locations)
        if not matched_loc and job.get("work_mode") != "remote":
            return False

    custom_kw = preferences.get("custom_keywords", "").strip()
    if custom_kw:
        kws = [k.strip().lower() for k in custom_kw.split(",") if k.strip()]
        full_text = f"{job.get('title', '')} {job.get('location', '')}".lower()
        if not any(k in full_text for k in kws):
            return False

    floor = int(preferences.get("min_salary") or 0)
    if floor:
        top = job.get("max_salary")
        if top is not None and top >= 1000 and top < floor:   # unknown and hourly (< 1000) salaries still match
            return False

    kinds = preferences.get("employment_types") or []
    if kinds and (job.get("employment_type") or "full_time") not in kinds:
        return False

    excluded_kw = preferences.get("excluded_keywords", "").strip()
    if excluded_kw:
        excs = [k.strip().lower() for k in excluded_kw.split(",") if k.strip()]
        full_text = f"{job.get('title', '')} {job.get('location', '')}".lower()
        if any(exc in full_text for exc in excs):
            return False

    return True


def detect_geo_hub(location: str | None, title: str | None) -> str:
    text = f"{location or ''} {title or ''}".lower()
    if any(k in text for k in ['india', 'bengaluru', 'bangalore', 'gurgaon', 'gurugram', 'hyderabad', 'mumbai', 'pune', 'noida', 'delhi']):
        return 'india'
    if any(k in text for k in [
        'united states', 'usa', 'san francisco', 'sf bay', 'new york', 'nyc', 'seattle',
        'austin', 'california', ' ca', ' ny', ' wa', ' tx', ' ma', 'boston', 'los angeles',
        'remote - us', 'us - remote', 'remote (us)', 'remote, us'
    ]):
        return 'us'
    if any(k in text for k in [
        'london', 'united kingdom', ' uk', 'germany', 'berlin', 'munich', 'france',
        'paris', 'amsterdam', 'netherlands', 'dublin', 'ireland', 'sweden', 'stockholm', 'switzerland', 'zurich'
    ]):
        return 'europe'
    if any(k in text for k in ['singapore', 'tokyo', 'japan', 'sydney', 'australia', 'melbourne', 'korea', 'seoul']):
        return 'apac'
    return 'global'


def detect_experience_tier(seniority: str | None, title: str | None = None) -> str:
    sen = (seniority or "mid").lower()
    if sen == "intern" or sen == "junior":
        return "0-2"
    if sen == "lead":
        return "8+"
    if sen == "senior":
        return "5-8"
    return "2-5"
