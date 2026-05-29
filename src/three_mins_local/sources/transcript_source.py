"""Sources 2 & 3 — meeting transcripts.

Decision logic per meeting:

    IF a CART transcript exists  -> download/read it (preferred; cheap, accurate)
    ELIF a video exists          -> pull audio + run Whisper transcription
    ELSE                         -> use a bundled fixture transcript (offline demo)

Returns raw transcript text; parsing into segments happens in
``processing.transcript_parser``.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from ..config import FIXTURES_DIR, Settings
from ..models import Meeting

log = logging.getLogger(__name__)


class TranscriptSource:
    def __init__(self, settings: Optional[Settings] = None, allow_fixtures: bool = True):
        self.settings = settings or Settings()
        self.allow_fixtures = allow_fixtures

    def get_transcript_text(self, meeting: Meeting) -> str:
        """Return the raw transcript text for a meeting."""
        # 1. CART transcript (preferred)
        if meeting.transcript_url:
            text = self._download_cart(meeting.transcript_url)
            if text:
                log.info("Using CART transcript for %s", meeting.id)
                return text

        # 2. Video -> audio -> Whisper
        if meeting.video_url:
            text = self._transcribe_video(meeting.video_url)
            if text:
                log.info("Transcribed video for %s via Whisper", meeting.id)
                return text

        # 3. Fixture fallback
        if self.allow_fixtures:
            text = self._load_fixture(meeting)
            if text:
                log.info("Using fixture transcript for %s", meeting.id)
                return text

        raise RuntimeError(
            f"No transcript available for meeting {meeting.id!r} "
            "(no CART transcript, no transcribable video, no fixture)."
        )

    # -- CART ---------------------------------------------------------------
    def _download_cart(self, url: str) -> Optional[str]:
        try:
            import requests
        except ImportError:  # pragma: no cover
            return None
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 200 and resp.text.strip():
                return resp.text
            log.info("CART download returned HTTP %s", resp.status_code)
        except Exception as exc:
            log.info("CART download failed (%s)", exc)
        return None

    # -- Video -> Whisper ---------------------------------------------------
    def _transcribe_video(self, video_url: str) -> Optional[str]:
        """Pull audio from the video URL and run Whisper.

        Heavy optional path: requires yt-dlp + ffmpeg + a Whisper backend.
        Lazily imported so the core pipeline has no hard dependency on them.
        """
        try:
            from ..transcription.whisper_transcriber import WhisperTranscriber
        except Exception as exc:  # pragma: no cover - optional path
            log.warning("Whisper transcription unavailable: %s", exc)
            return None
        try:
            transcriber = WhisperTranscriber(self.settings)
            return transcriber.transcribe_url(video_url)
        except Exception as exc:  # pragma: no cover - optional path
            log.warning("Whisper transcription failed: %s", exc)
            return None

    # -- Fixtures -----------------------------------------------------------
    def _load_fixture(self, meeting: Meeting) -> Optional[str]:
        # Convention: fixtures/transcript_<meeting.id>.txt, else a default.
        candidates = [
            FIXTURES_DIR / f"transcript_{meeting.id}.txt",
            FIXTURES_DIR / "transcript_council_2026-05-28.txt",
        ]
        for path in candidates:
            if path.exists():
                return Path(path).read_text()
        return None
