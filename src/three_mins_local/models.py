"""Core data models for the 3 Mins Local pipeline.

These are plain dataclasses so they serialize cleanly to/from JSON (the pipeline
caches intermediate artifacts to disk) and stay easy to test.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Optional


class SpeakerRole(str, Enum):
    """Who is talking in a transcript segment."""

    COUNCILMEMBER = "councilmember"
    STAFF = "staff"          # city staff, CAO/CLA, dept general managers, analysts
    CLERK = "clerk"          # clerk / chair procedural ("next speaker", timekeeping)
    PUBLIC = "public"        # a member of the public giving testimony
    UNKNOWN = "unknown"


@dataclass
class TranscriptSegment:
    """A single speaker turn in a meeting transcript."""

    index: int
    text: str
    speaker_raw: str = ""              # label as it appeared, e.g. ">> CHAIR"
    speaker_name: str = ""             # cleaned name, e.g. "Soto-Martinez"
    role: SpeakerRole = SpeakerRole.UNKNOWN
    start: Optional[float] = None      # seconds from meeting start, if known
    end: Optional[float] = None

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["role"] = self.role.value
        return d


@dataclass
class PublicComment:
    """A piece of public testimony, with its ranking score."""

    speaker_name: str
    text: str
    start: Optional[float] = None
    end: Optional[float] = None
    topics: list[str] = field(default_factory=list)
    agenda_refs: list[str] = field(default_factory=list)
    score: float = 0.0
    score_breakdown: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class AgendaItem:
    """An item on a meeting agenda, plus the pipeline's plain-English analysis."""

    item_id: str                       # council file number, e.g. "23-0145"
    title: str
    description: str = ""
    item_type: str = ""                # motion | contract | ordinance | report | ...
    action: str = ""                   # what the body did (adopted, continued, ...)
    vote: str = ""                     # e.g. "12-0" or "" if none
    topics: list[str] = field(default_factory=list)

    # Generated analysis (filled by AgendaProcessor):
    what_happened: str = ""
    why_it_matters: str = ""
    what_next: str = ""
    translation: str = ""              # "Translation From Government"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Meeting:
    """A council or committee meeting captured from the calendar."""

    id: str
    title: str
    date: str                          # ISO date string, e.g. "2026-05-28"
    committee: str = ""
    agenda_url: str = ""
    video_url: str = ""
    transcript_url: str = ""
    council_files: list[str] = field(default_factory=list)

    # Populated as the pipeline runs:
    transcript_path: str = ""
    agenda_items: list[AgendaItem] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["agenda_items"] = [a.to_dict() for a in self.agenda_items]
        return d


@dataclass
class Newsletter:
    """The final 3 Mins Local issue."""

    meeting_id: str
    subject: str
    hook: str
    what_happened: list[str]           # 3–5 scannable bullets
    big_story: str
    why_it_matters: str
    translation: str
    public_comment_of_the_day: str
    la_vibes: str
    numbers_that_matter: list[str]
    whats_next: str
    closing: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_markdown(self) -> str:
        """Render the issue as a readable markdown email."""
        lines: list[str] = []
        lines.append(f"**SUBJECT:** {self.subject}\n")
        lines.append("# 3 Mins Local\n")
        lines.append(f"_{self.hook}_\n")

        lines.append("## 📋 What Actually Happened")
        for b in self.what_happened:
            lines.append(f"- {b}")
        lines.append("")

        lines.append("## 🏛️ The Big Story")
        lines.append(self.big_story + "\n")

        lines.append("## 🤔 Why It Matters")
        lines.append(self.why_it_matters + "\n")

        lines.append("## 🔤 Translation From Government")
        lines.append(self.translation + "\n")

        lines.append("## 🎤 Public Comment of the Day")
        lines.append(self.public_comment_of_the_day + "\n")

        lines.append("## 🌴 LA Vibes")
        lines.append(self.la_vibes + "\n")

        lines.append("## 🔢 Numbers That Matter")
        for n in self.numbers_that_matter:
            lines.append(f"- {n}")
        lines.append("")

        lines.append("## ⏭️ What's Next")
        lines.append(self.whats_next + "\n")

        lines.append("---")
        lines.append(f"_{self.closing}_")
        return "\n".join(lines)

    def word_count(self) -> int:
        parts = [
            self.hook, self.big_story, self.why_it_matters, self.translation,
            self.public_comment_of_the_day, self.la_vibes, self.whats_next,
            self.closing,
            *self.what_happened, *self.numbers_that_matter,
        ]
        return sum(len(p.split()) for p in parts)
