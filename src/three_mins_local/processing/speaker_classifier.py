"""Classify each transcript segment's speaker as councilmember / staff /
clerk / public.

Strategy (in priority order):
    1. Title cues in the speaker label ("COUNCILMEMBER ...", "CITY ATTORNEY ...").
    2. Generic public markers ("SPEAKER", "CALLER", "PUBLIC COMMENT").
    3. Context: speakers who appear *inside* a public-comment window and don't
       carry an official title are treated as members of the public.

The public-comment window detection lives in ``public_comment.py``; this module
exposes a label-only classifier plus a helper to apply it across segments.
"""
from __future__ import annotations

from ..config import CLERK_TITLE_CUES, COUNCIL_TITLE_CUES, STAFF_TITLE_CUES
from ..models import SpeakerRole, TranscriptSegment

_PUBLIC_LABEL_CUES = ("speaker", "caller", "public comment", "public testimony", "member of the public")


def classify_label(speaker_label: str) -> SpeakerRole:
    """Classify a speaker purely from their label text."""
    label = speaker_label.lower().lstrip(">").strip()

    # Clerk before staff/council, since "city clerk" contains neither.
    if any(cue in label for cue in CLERK_TITLE_CUES):
        return SpeakerRole.CLERK
    if any(cue in label for cue in COUNCIL_TITLE_CUES):
        return SpeakerRole.COUNCILMEMBER
    if any(cue in label for cue in STAFF_TITLE_CUES):
        return SpeakerRole.STAFF
    if any(cue in label for cue in _PUBLIC_LABEL_CUES):
        return SpeakerRole.PUBLIC
    return SpeakerRole.UNKNOWN


def classify_segments(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Assign a role to every segment based on its label (in place)."""
    for seg in segments:
        seg.role = classify_label(seg.speaker_raw or seg.speaker_name)
    return segments
