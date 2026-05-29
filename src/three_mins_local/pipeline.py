"""End-to-end orchestration for 3 Mins Local.

calendar -> transcript -> parse -> classify -> public comment -> rank
         -> agenda analysis -> newsletter -> disk

Every stage degrades gracefully: missing live data falls back to fixtures, and
a missing LLM key falls back to deterministic templates, so `run()` always
produces a complete issue.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .config import Settings
from .generation.llm import LLMClient
from .generation.newsletter import NewsletterGenerator
from .models import AgendaItem, Meeting, Newsletter, PublicComment
from .processing.agenda_processor import AgendaProcessor, load_agenda_fixture
from .processing.public_comment import extract_public_comments
from .processing.ranker import comment_of_the_day, rank_comments
from .processing.speaker_classifier import classify_segments
from .processing.transcript_parser import parse_transcript
from .sources.calendar_scraper import CalendarScraper
from .sources.transcript_source import TranscriptSource

log = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    meeting: Meeting
    newsletter: Newsletter
    public_comments: list[PublicComment] = field(default_factory=list)
    top_comment: Optional[PublicComment] = None
    transcript_segments: int = 0

    def to_dict(self) -> dict:
        return {
            "meeting": self.meeting.to_dict(),
            "newsletter": self.newsletter.to_dict(),
            "top_comment": self.top_comment.to_dict() if self.top_comment else None,
            "public_comments": [c.to_dict() for c in self.public_comments],
            "transcript_segments": self.transcript_segments,
        }


class Pipeline:
    def __init__(self, settings: Optional[Settings] = None, allow_fixtures: bool = True):
        self.settings = settings or Settings()
        self.allow_fixtures = allow_fixtures
        self.llm = LLMClient(self.settings)
        self.calendar = CalendarScraper(allow_fixtures=allow_fixtures)
        self.transcripts = TranscriptSource(self.settings, allow_fixtures=allow_fixtures)
        self.agenda_processor = AgendaProcessor(self.llm)
        self.newsletter_gen = NewsletterGenerator(self.llm, self.settings)

    def list_meetings(self, limit: Optional[int] = None) -> list[Meeting]:
        return self.calendar.fetch(limit=limit)

    def run_meeting(self, meeting: Meeting) -> PipelineResult:
        log.info("Processing meeting %s — %s", meeting.id, meeting.title)

        # 1. Transcript
        raw = self.transcripts.get_transcript_text(meeting)
        segments = parse_transcript(raw)
        classify_segments(segments)

        # 2. Public comments
        public_segments = extract_public_comments(segments)

        # 3. Agenda
        agenda_items = meeting.agenda_items or load_agenda_fixture(meeting)
        agenda_items = self.agenda_processor.process(agenda_items)
        meeting.agenda_items = agenda_items

        # 4. Rank comments against the agenda
        ranked = rank_comments(public_segments, agenda_items)
        top = comment_of_the_day(ranked)

        # 5. Newsletter
        newsletter = self.newsletter_gen.generate(meeting, agenda_items, top)

        return PipelineResult(
            meeting=meeting,
            newsletter=newsletter,
            public_comments=ranked,
            top_comment=top,
            transcript_segments=len(segments),
        )

    def run_latest(self, limit: int = 1) -> list[PipelineResult]:
        meetings = self.list_meetings(limit=limit)
        return [self.run_meeting(m) for m in meetings]

    # -- persistence --------------------------------------------------------
    def save(self, result: PipelineResult, output_dir: Optional[Path] = None) -> dict[str, Path]:
        out = Path(output_dir or self.settings.output_dir)
        out.mkdir(parents=True, exist_ok=True)
        stem = f"{result.meeting.date or 'undated'}_{result.meeting.id}"

        md_path = out / f"{stem}.md"
        json_path = out / f"{stem}.json"
        md_path.write_text(result.newsletter.to_markdown())
        json_path.write_text(json.dumps(result.to_dict(), indent=2))
        log.info("Wrote %s and %s", md_path, json_path)
        return {"markdown": md_path, "json": json_path}
