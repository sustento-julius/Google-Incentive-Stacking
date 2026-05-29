"""Detect public-comment testimony in a classified transcript.

Two signals combine:
    1. Window detection — procedural cues from the clerk/chair open and close a
       public-comment period ("general public comment", "you have one minute",
       "your time has expired", ...).
    2. Speaker role — within a window, a speaker who is not a councilmember,
       not staff, and not the clerk is treated as a member of the public.

Returns the list of public-comment segments (also flips their role to PUBLIC).
"""
from __future__ import annotations

from ..config import PUBLIC_COMMENT_CLOSE_CUES, PUBLIC_COMMENT_OPEN_CUES
from ..models import SpeakerRole, TranscriptSegment


def _has_cue(text: str, cues: list[str]) -> bool:
    low = text.lower()
    return any(cue in low for cue in cues)


def detect_public_comment_windows(segments: list[TranscriptSegment]) -> list[tuple[int, int]]:
    """Return [start_index, end_index) ranges where public comment is active.

    A window opens on an open-cue (typically uttered by the clerk/chair) and
    closes on a close-cue or when an official clearly resumes regular business.
    """
    windows: list[tuple[int, int]] = []
    open_at: int | None = None

    for i, seg in enumerate(segments):
        text = seg.text
        if open_at is None:
            if _has_cue(text, PUBLIC_COMMENT_OPEN_CUES):
                open_at = i
        else:
            if _has_cue(text, PUBLIC_COMMENT_CLOSE_CUES):
                windows.append((open_at, i + 1))
                open_at = None

    if open_at is not None:
        windows.append((open_at, len(segments)))
    return windows


def _in_any_window(index: int, windows: list[tuple[int, int]]) -> bool:
    return any(start <= index < end for start, end in windows)


def extract_public_comments(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    """Identify public-comment segments and set their role to PUBLIC."""
    windows = detect_public_comment_windows(segments)
    public: list[TranscriptSegment] = []

    for i, seg in enumerate(segments):
        is_official = seg.role in (
            SpeakerRole.COUNCILMEMBER,
            SpeakerRole.STAFF,
            SpeakerRole.CLERK,
        )
        # Already-tagged public speakers always count.
        if seg.role == SpeakerRole.PUBLIC:
            public.append(seg)
            continue
        # Within a comment window, a non-official speaker is the public.
        if _in_any_window(i, windows) and not is_official:
            seg.role = SpeakerRole.PUBLIC
            public.append(seg)

    # Filter out trivial procedural fragments ("Thank you.").
    return [s for s in public if len(s.text.split()) >= 4]
