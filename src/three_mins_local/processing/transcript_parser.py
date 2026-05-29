"""Parse raw transcript text into structured speaker turns.

Handles the common CART / Whisper conventions seen on LA City Clerk
transcripts:

    >> SPEAKER NAME [HH:MM:SS]: text
    >> SPEAKER NAME: text
    [HH:MM:SS] SPEAKER NAME: text
    SPEAKER NAME: text

Lines without a new speaker marker are treated as continuations of the prior
speaker's turn. Bracketed stage directions like ``[applause]`` are kept inline
because the ranker uses them as emotional-intensity signals.
"""
from __future__ import annotations

import re

from ..models import SpeakerRole, TranscriptSegment

# >> SPEAKER [00:01:23]: text     /     >> SPEAKER: text
_RE_SPEAKER_MARKER = re.compile(
    r"^\s*>>\s*(?P<speaker>[^:\[]+?)\s*(?:\[(?P<ts>\d{1,2}:\d{2}(?::\d{2})?)\])?\s*:\s*(?P<text>.*)$"
)
# [00:01:23] SPEAKER: text
_RE_TS_SPEAKER = re.compile(
    r"^\s*\[(?P<ts>\d{1,2}:\d{2}(?::\d{2})?)\]\s*(?P<speaker>[A-Z][^:]{1,60}?)\s*:\s*(?P<text>.*)$"
)
# SPEAKER NAME: text   (ALL-CAPS-ish leading label, <= ~60 chars, no leading lowercase prose)
_RE_PLAIN_SPEAKER = re.compile(
    r"^\s*(?P<speaker>[A-Z][A-Za-z'.\-() ]{1,58}?)\s*:\s*(?P<text>.+)$"
)


def _parse_timestamp(ts: str | None) -> float | None:
    if not ts:
        return None
    parts = [int(p) for p in ts.split(":")]
    if len(parts) == 3:
        h, m, s = parts
    elif len(parts) == 2:
        h, m, s = 0, parts[0], parts[1]
    else:
        return None
    return float(h * 3600 + m * 60 + s)


_GENERIC_ROLE_LABELS = {"speaker", "caller", "public comment", "member of the public", "next speaker"}


def _clean_speaker(raw: str) -> str:
    """Normalize whitespace in a speaker label (keeps the full label)."""
    return re.sub(r"\s+", " ", raw).strip()


def _display_name(raw: str) -> str:
    """Human-friendly name for a speaker label.

    Turns generic CART labels like "SPEAKER (DARNELL WRIGHT)" into
    "DARNELL WRIGHT" while leaving titled speakers ("COUNCILMEMBER PRICE")
    untouched.
    """
    label = _clean_speaker(raw)
    m = re.match(r"^(?P<role>[A-Za-z .'-]+?)\s*\((?P<name>[^)]+)\)\s*$", label)
    if m and m.group("role").strip().lower() in _GENERIC_ROLE_LABELS:
        return m.group("name").strip()
    return label


def parse_transcript(text: str) -> list[TranscriptSegment]:
    segments: list[TranscriptSegment] = []
    current: TranscriptSegment | None = None

    for line in text.splitlines():
        if not line.strip():
            continue

        speaker_raw = None
        ts = None
        body = None

        m = _RE_SPEAKER_MARKER.match(line)
        if m:
            speaker_raw, ts, body = m.group("speaker"), m.group("ts"), m.group("text")
        else:
            m = _RE_TS_SPEAKER.match(line)
            if m:
                speaker_raw, ts, body = m.group("speaker"), m.group("ts"), m.group("text")
            else:
                m = _RE_PLAIN_SPEAKER.match(line)
                if m and _looks_like_label(m.group("speaker")):
                    speaker_raw, body = m.group("speaker"), m.group("text")

        if speaker_raw is not None:
            # Finalize the previous turn.
            if current is not None:
                current.text = current.text.strip()
                segments.append(current)
            current = TranscriptSegment(
                index=len(segments),
                speaker_raw=f">> {_clean_speaker(speaker_raw)}",
                speaker_name=_display_name(speaker_raw),
                text=body.strip(),
                start=_parse_timestamp(ts),
                role=SpeakerRole.UNKNOWN,
            )
        else:
            # Continuation line.
            if current is not None:
                current.text = (current.text + " " + line.strip()).strip()
            # else: preamble before first speaker — ignore.

    if current is not None:
        current.text = current.text.strip()
        segments.append(current)

    return segments


def _looks_like_label(candidate: str) -> bool:
    """Heuristic: a real speaker label is short and not ordinary prose.

    Accept labels that are mostly uppercase OR contain a known role word, and
    reject things like "Note" inside a sentence by requiring few words.
    """
    words = candidate.split()
    if len(words) > 6:
        return False
    letters = [c for c in candidate if c.isalpha()]
    if not letters:
        return False
    upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
    return upper_ratio >= 0.5
