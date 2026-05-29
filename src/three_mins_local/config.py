"""Runtime configuration + shared constants for the pipeline."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # optional, but nice for local dev
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv is optional
    pass

PACKAGE_ROOT = Path(__file__).resolve().parent
FIXTURES_DIR = PACKAGE_ROOT / "fixtures"
REPO_ROOT = PACKAGE_ROOT.parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "output"

CALENDAR_URL = "https://clerk.lacity.gov/calendar"

# Newsletter length targets (words).
TARGET_WORDS_MIN = 500
TARGET_WORDS_MAX = 700
HARD_MAX_WORDS = 900


@dataclass
class Settings:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    llm_model: str = field(default_factory=lambda: os.getenv("TML_LLM_MODEL", "gemini-2.0-flash"))
    whisper_backend: str = field(default_factory=lambda: os.getenv("TML_WHISPER_BACKEND", "faster-whisper"))
    whisper_model: str = field(default_factory=lambda: os.getenv("TML_WHISPER_MODEL", "base"))
    output_dir: Path = field(default_factory=lambda: DEFAULT_OUTPUT_DIR)

    @property
    def has_llm(self) -> bool:
        return bool(self.gemini_api_key)


# ---------------------------------------------------------------------------
# Domain vocabularies used by classification / ranking / translation.
# ---------------------------------------------------------------------------

# Newsworthy civic topics -> the keywords that signal them.
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "housing": ["housing", "affordable", "rent", "tenant", "eviction", "landlord", "rso", "rent control"],
    "homelessness": ["homeless", "unhoused", "encampment", "shelter", "interim housing", "41.18", "skid row"],
    "policing": ["police", "lapd", "officer", "public safety", "crime", "use of force", "reform"],
    "transportation": ["transit", "metro", "bus", "bike", "bus lane", "traffic", "parking", "vision zero", "sidewalk"],
    "olympics": ["olympic", "olympics", "2028", "la28", "games"],
    "corruption": ["corruption", "bribery", "indictment", "ethics", "conflict of interest", "fbi", "fraud"],
    "development": ["development", "zoning", "rezoning", "entitlement", "project", "permit", "density", "construction"],
    "labor": ["labor", "union", "wage", "worker", "minimum wage", "strike", "contract", "collective bargaining"],
    "climate": ["climate", "emissions", "solar", "ladwp", "green", "heat", "tree", "carbon", "electrification"],
    "budget": ["budget", "deficit", "funding", "appropriation", "reserve", "shortfall", "fee"],
}

# Cues that an emotional / high-energy moment occurred.
INTENSITY_CUES: list[str] = [
    "applause", "laughter", "cheers", "boos", "shouting", "gavel",
    "out of order", "point of order", "interrupt", "outrage", "furious",
]

# Cues that public-comment testimony is happening / a window is opening.
PUBLIC_COMMENT_OPEN_CUES: list[str] = [
    "general public comment",
    "public comment",
    "multiple agenda item",
    "please state your name",
    "you have one minute",
    "you'll have one minute",
    "next speaker",
    "next caller",
    "caller, you're on the line",
    "first speaker",
]

PUBLIC_COMMENT_CLOSE_CUES: list[str] = [
    "your time has expired",
    "time is up",
    "thank you, next",
    "that concludes public comment",
    "closing public comment",
    "we'll move on",
]

# Titles that mark a speaker as an elected councilmember.
COUNCIL_TITLE_CUES: list[str] = [
    "councilmember", "councilman", "councilwoman", "council member",
    "president pro tem", "council president", "president",
    "chair", "vice chair", "supervisor",
]

# Titles / labels that mark a speaker as city staff or procedural clerk.
STAFF_TITLE_CUES: list[str] = [
    "city attorney", "deputy city attorney", "city administrative officer", "cao",
    "chief legislative analyst", "cla", "general manager", "gm", "director",
    "deputy", "analyst", "staff", "presenter", "lapd chief", "fire chief",
    "department of", "bureau of", "sergeant at arms", "engineer",
]

CLERK_TITLE_CUES: list[str] = [
    "city clerk", "clerk", "executive officer", "reading clerk",
]

# Government-speak -> plain English (used by the translation fallback).
GOVERNMENT_PHRASEBOOK: dict[str, str] = {
    "mobility corridor optimization": "turning a car lane into a bus lane",
    "mobility corridor": "a street they want buses and bikes to use",
    "right-sizing": "cutting",
    "fiscal sustainability": "we're short on money",
    "structural deficit": "we spend more than we take in, every year",
    "enhanced enforcement": "more tickets / more police",
    "interim housing": "temporary shelter",
    "permanent supportive housing": "apartments with on-site services for formerly homeless residents",
    "adaptive reuse": "turning old offices into apartments",
    "public-private partnership": "the city pays, a private company runs it",
    "value capture": "taxing the bump in property value the city's own project creates",
    "community engagement": "meetings where residents get to comment",
    "stakeholder": "anyone affected",
    "robust": "we hope it's big enough",
    "leverage": "use",
    "utilize": "use",
    "incentivize": "pay people to",
    "deconfliction": "stop two city plans from fighting each other",
    "operationalize": "actually do",
    "feasibility study": "we'll study whether it's even possible",
    "ground lease": "the city keeps the land and rents it out long-term",
    "entitlements": "permission to build",
    "by-right": "no extra approvals needed",
    "density bonus": "build taller in exchange for some affordable units",
    "transit-oriented": "near a train or bus line",
    "complete street": "a street redesigned for cars, buses, bikes, and walkers",
}
