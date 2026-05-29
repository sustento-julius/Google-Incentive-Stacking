"""Score and rank public comments to find the Public Comment of the Day.

Four weighted dimensions (matching the product spec):

    newsworthiness   — touches housing, homelessness, policing, transit,
                       Olympics, corruption, development, labor, climate, budget
    emotional        — applause / laughter / confrontation / outrage cues
    virality         — unusual phrasing, memorable quotes, humor, brevity-punch
    civic_relevance  — references active agenda items / pending votes / council files

Ethics guardrail (also enforced in prompts): never mock ordinary residents.
Humor targets absurd situations, bureaucracy, and meeting dynamics — not people.
"""
from __future__ import annotations

import re

from ..config import INTENSITY_CUES, TOPIC_KEYWORDS
from ..models import AgendaItem, PublicComment, TranscriptSegment

_COUNCIL_FILE_RE = re.compile(r"\b\d{2}-\d{4}(?:-S\d+)?\b")

# Phrases that read as memorable / internet-native / quotably odd.
_VIRALITY_MARKERS = [
    "i pay your salary", "do your job", "this is insane", "follow the money",
    "you work for us", "shame", "literally", "are you kidding", "with all due respect",
    "let me be clear", "point blank", "frankly", "absurd", "ridiculous",
]

WEIGHTS = {
    "newsworthiness": 0.35,
    "emotional": 0.20,
    "virality": 0.20,
    "civic_relevance": 0.25,
}


def _topics_in(text: str) -> list[str]:
    low = text.lower()
    found = []
    for topic, kws in TOPIC_KEYWORDS.items():
        if any(kw in low for kw in kws):
            found.append(topic)
    return found


def _newsworthiness(text: str, topics: list[str]) -> float:
    if not topics:
        return 0.0
    # More distinct hot topics -> higher, saturating at ~3.
    return min(1.0, 0.45 + 0.275 * (len(topics) - 1))


def _emotional(text: str) -> float:
    low = text.lower()
    hits = sum(1 for cue in INTENSITY_CUES if cue in low)
    exclaims = min(text.count("!"), 3) * 0.15
    caps_words = len(re.findall(r"\b[A-Z]{3,}\b", text))
    caps = min(caps_words, 4) * 0.1
    return min(1.0, 0.4 * hits + exclaims + caps)


def _virality(text: str) -> float:
    low = text.lower()
    marker_hits = sum(1 for m in _VIRALITY_MARKERS if m in low)
    score = min(1.0, 0.35 * marker_hits)
    # A short, punchy comment is more quotable than a rambling one.
    wc = len(text.split())
    if 8 <= wc <= 45:
        score += 0.2
    return min(1.0, score)


def _civic_relevance(text: str, agenda_files: set[str], agenda_topics: set[str]) -> tuple[float, list[str]]:
    low = text.lower()
    refs = sorted(set(_COUNCIL_FILE_RE.findall(text)) & agenda_files) if agenda_files else \
        sorted(set(_COUNCIL_FILE_RE.findall(text)))
    score = 0.0
    if refs:
        score += min(0.7, 0.4 + 0.15 * (len(refs) - 1))
    # References to pending action.
    if any(p in low for p in ["vote", "motion", "agenda item", "item number", "council file", "ordinance"]):
        score += 0.3
    # Comment topic overlaps something actually on the agenda.
    if agenda_topics and (set(_topics_in(text)) & agenda_topics):
        score += 0.2
    return min(1.0, score), refs


def score_comment(
    segment: TranscriptSegment,
    agenda_files: set[str] | None = None,
    agenda_topics: set[str] | None = None,
) -> PublicComment:
    text = segment.text
    topics = _topics_in(text)
    civic, refs = _civic_relevance(text, agenda_files or set(), agenda_topics or set())

    breakdown = {
        "newsworthiness": round(_newsworthiness(text, topics), 3),
        "emotional": round(_emotional(text), 3),
        "virality": round(_virality(text), 3),
        "civic_relevance": round(civic, 3),
    }
    total = round(sum(WEIGHTS[k] * v for k, v in breakdown.items()), 4)

    return PublicComment(
        speaker_name=segment.speaker_name,
        text=text,
        start=segment.start,
        end=segment.end,
        topics=topics,
        agenda_refs=refs,
        score=total,
        score_breakdown=breakdown,
    )


def rank_comments(
    public_segments: list[TranscriptSegment],
    agenda_items: list[AgendaItem] | None = None,
) -> list[PublicComment]:
    """Score every public comment and return them sorted high-to-low."""
    agenda_items = agenda_items or []
    agenda_files = {a.item_id for a in agenda_items}
    agenda_topics: set[str] = set()
    for a in agenda_items:
        agenda_topics.update(a.topics)

    scored = [score_comment(seg, agenda_files, agenda_topics) for seg in public_segments]
    scored.sort(key=lambda c: c.score, reverse=True)
    return scored


def comment_of_the_day(ranked: list[PublicComment]) -> PublicComment | None:
    return ranked[0] if ranked else None
