"""Turn raw agenda items into plain-English analysis.

For each item we produce four fields:
    What Happened / Why It Matters / What Happens Next / Translation From Government

Uses Gemini when available; otherwise a deterministic template that leans on the
GOVERNMENT_PHRASEBOOK to decode bureaucratic phrasing.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from ..config import FIXTURES_DIR, GOVERNMENT_PHRASEBOOK, TOPIC_KEYWORDS
from ..generation.llm import LLMClient
from ..generation.prompts import AGENDA_TRANSLATE_PROMPT, AGENDA_TRANSLATE_SYSTEM
from ..models import AgendaItem, Meeting

log = logging.getLogger(__name__)


def _detect_topics(text: str) -> list[str]:
    low = text.lower()
    return [t for t, kws in TOPIC_KEYWORDS.items() if any(kw in low for kw in kws)]


def load_agenda_fixture(meeting: Meeting) -> list[AgendaItem]:
    """Load agenda items from a bundled fixture for offline runs."""
    candidates = [
        FIXTURES_DIR / f"agenda_{meeting.id}.json",
        FIXTURES_DIR / "agenda_council_2026-05-28.json",
    ]
    for path in candidates:
        if path.exists():
            data = json.loads(path.read_text())
            return [
                AgendaItem(
                    item_id=i.get("item_id", ""),
                    title=i.get("title", ""),
                    description=i.get("description", ""),
                    item_type=i.get("item_type", ""),
                    action=i.get("action", ""),
                    vote=i.get("vote", ""),
                )
                for i in data["items"]
            ]
    return []


class AgendaProcessor:
    def __init__(self, llm: Optional[LLMClient] = None):
        self.llm = llm or LLMClient()

    def process(self, items: list[AgendaItem]) -> list[AgendaItem]:
        for item in items:
            item.topics = _detect_topics(f"{item.title} {item.description}")
            analysis = self._analyze(item)
            item.what_happened = analysis["what_happened"]
            item.why_it_matters = analysis["why_it_matters"]
            item.what_next = analysis["what_next"]
            item.translation = analysis["translation"]
        return items

    def _analyze(self, item: AgendaItem) -> dict[str, str]:
        if self.llm.available:
            result = self.llm.generate_json(
                AGENDA_TRANSLATE_PROMPT.format(
                    item_id=item.item_id,
                    title=item.title,
                    description=item.description or "(none)",
                    item_type=item.item_type or "(unspecified)",
                    action=item.action or "(no action recorded)",
                    vote=item.vote or "(no vote)",
                ),
                system=AGENDA_TRANSLATE_SYSTEM,
                temperature=0.6,
            )
            if result and all(k in result for k in ("what_happened", "why_it_matters", "what_next", "translation")):
                return {k: str(result[k]) for k in ("what_happened", "why_it_matters", "what_next", "translation")}
            log.info("LLM agenda analysis incomplete for %s; using template.", item.item_id)
        return self._template_analysis(item)

    # -- deterministic fallback --------------------------------------------
    def _template_analysis(self, item: AgendaItem) -> dict[str, str]:
        action = item.action or "took it up"
        what = f"Council {self._action_phrase(item)} (CF {item.item_id})."
        why = self._why_template(item)
        nxt = self._next_template(item)
        translation = self._translate(item)
        return {
            "what_happened": what,
            "why_it_matters": why,
            "what_next": nxt,
            "translation": translation,
        }

    @staticmethod
    def _action_phrase(item: AgendaItem) -> str:
        act = (item.action or "").lower()
        base = item.title.rstrip(".")
        vote = f" on a {item.vote} vote" if item.vote else ""
        if "adopt" in act or "approv" in act:
            return f"approved “{base}”{vote}"
        if "continu" in act or "defer" in act:
            return f"punted “{base}” to a later date{vote}"
        if "refer" in act:
            return f"sent “{base}” back to committee{vote}"
        if "receiv" in act:
            return f"received-and-filed “{base}” (i.e. noted it and moved on)"
        return f"considered “{base}”{vote}"

    def _why_template(self, item: AgendaItem) -> str:
        if item.topics:
            topic = item.topics[0]
            return f"It lands squarely in LA's {topic} fight — the kind of decision residents actually feel."
        return "It's the sort of routine-sounding item that quietly reshapes how the city runs."

    @staticmethod
    def _next_template(item: AgendaItem) -> str:
        act = (item.action or "").lower()
        if "continu" in act or "defer" in act:
            return "Expect it back on a future agenda — watch the council file for the new date."
        if "committee" in act or "refer" in act:
            return "It heads to committee next, where the real horse-trading happens."
        if "adopt" in act or "approv" in act:
            return "Now it moves to implementation; the mayor and departments take it from here."
        return "Track the council file for the next move."

    @staticmethod
    def _translate(item: AgendaItem) -> str:
        text = f"{item.title}. {item.description}".strip()
        low = text.lower()
        for jargon, plain in GOVERNMENT_PHRASEBOOK.items():
            if jargon in low:
                return f"“{jargon}” = {plain}."
        # No catalogued jargon: strip the most generic gov filler.
        cleaned = re.sub(
            r"\b(pursuant to|whereas|heretofore|aforementioned|notwithstanding)\b",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        short = cleaned.split(".")[0]
        return f"In plain English: {short}." if short else "In plain English: the city did a city thing."
