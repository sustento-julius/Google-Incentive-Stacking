"""Assemble the final 3 Mins Local issue from the structured briefing.

Uses Gemini for the prose when available; otherwise builds a complete,
on-brand issue from deterministic templates. Either way the result is trimmed
to the ~3-minute word budget.
"""
from __future__ import annotations

import logging
import re
from typing import Optional

from ..config import HARD_MAX_WORDS, Settings
from ..models import AgendaItem, Meeting, Newsletter, PublicComment
from .llm import LLMClient
from .prompts import NEWSLETTER_PROMPT, NEWSLETTER_SYSTEM

log = logging.getLogger(__name__)

_MONEY_RE = re.compile(r"\$[\d,]+(?:\.\d+)?(?:\s?(?:million|billion|m|b|k))?", re.IGNORECASE)
_VOTE_RE = re.compile(r"\b\d{1,2}-\d{1,2}\b")


class NewsletterGenerator:
    def __init__(self, llm: Optional[LLMClient] = None, settings: Optional[Settings] = None):
        self.settings = settings or Settings()
        self.llm = llm or LLMClient(self.settings)

    def generate(
        self,
        meeting: Meeting,
        agenda_items: list[AgendaItem],
        comment: Optional[PublicComment],
    ) -> Newsletter:
        numbers = self._extract_numbers(agenda_items, comment)
        if self.llm.available:
            nl = self._generate_llm(meeting, agenda_items, comment, numbers)
            if nl:
                return self._enforce_budget(nl)
            log.info("LLM newsletter generation failed; using template.")
        return self._enforce_budget(self._generate_template(meeting, agenda_items, comment, numbers))

    # -- LLM path -----------------------------------------------------------
    def _generate_llm(self, meeting, agenda_items, comment, numbers) -> Optional[Newsletter]:
        agenda_block = "\n".join(
            f"- CF {a.item_id}: {a.title}\n  what happened: {a.what_happened}\n"
            f"  why it matters: {a.why_it_matters}\n  next: {a.what_next}\n"
            f"  translation: {a.translation}"
            for a in agenda_items[:5]
        ) or "(no agenda items captured)"
        numbers_block = "\n".join(f"- {n}" for n in numbers) or "(none)"
        prompt = NEWSLETTER_PROMPT.format(
            meeting_title=meeting.title,
            committee=meeting.committee or "City Council",
            date=meeting.date,
            agenda_block=agenda_block,
            pc_speaker=comment.speaker_name if comment else "(no public comment)",
            pc_text=comment.text if comment else "",
            pc_topics=", ".join(comment.topics) if comment else "",
            pc_refs=", ".join(comment.agenda_refs) if comment else "",
            numbers_block=numbers_block,
        )
        data = self.llm.generate_json(prompt, system=NEWSLETTER_SYSTEM, temperature=0.85)
        if not data:
            return None
        try:
            return Newsletter(
                meeting_id=meeting.id,
                subject=str(data["subject"]),
                hook=str(data["hook"]),
                what_happened=[str(x) for x in data["what_happened"]][:5],
                big_story=str(data["big_story"]),
                why_it_matters=str(data["why_it_matters"]),
                translation=str(data["translation"]),
                public_comment_of_the_day=str(data["public_comment_of_the_day"]),
                la_vibes=str(data["la_vibes"]),
                numbers_that_matter=[str(x) for x in data["numbers_that_matter"]][:4],
                whats_next=str(data["whats_next"]),
                closing=str(data["closing"]),
            )
        except (KeyError, TypeError) as exc:
            log.info("LLM newsletter JSON missing keys (%s).", exc)
            return None

    # -- Template path ------------------------------------------------------
    def _generate_template(self, meeting, agenda_items, comment, numbers) -> Newsletter:
        top = agenda_items[0] if agenda_items else None
        committee = meeting.committee or "City Council"

        if top:
            subject = self._subjectify(top.title)
            context = self._first_sentence(top.description)
            big_story = f"{top.what_happened} {context}".strip()
            translation = top.translation
        else:
            subject = f"What went down at {committee}"
            big_story = "A quieter day at City Hall — mostly procedural items and reports."
            translation = "Nothing that needs a decoder ring today."

        hook = (
            f"Good morning, LA. The {committee} met {self._friendly_date(meeting.date)}, "
            f"so you didn't have to. Here's the 3-minute version."
        )

        what_happened = []
        for a in agenda_items[:5]:
            what_happened.append(f"{a.what_happened}")
        if not what_happened:
            what_happened = ["Council worked through a light, procedural agenda."]

        why_it_matters = top.why_it_matters if top else (
            "Even the boring stuff sets the table for the fights to come."
        )

        if comment:
            ref = f" (re: CF {comment.agenda_refs[0]})" if comment.agenda_refs else ""
            pc = (
                f"During public comment{ref}, {self._speaker_label(comment.speaker_name)} said: "
                f"“{self._trim_quote(comment.text)}” "
                f"{self._pc_why(comment)}"
            )
        else:
            pc = "No standout public comment today — a rare quiet mic at City Hall."

        la_vibes = self._vibes(agenda_items, comment)
        whats_next = top.what_next if top else "Check the council calendar for the next meeting."
        closing = "That's your 3 minutes. Now go outside — it's LA, the weather's doing its thing. 🌴"

        return Newsletter(
            meeting_id=meeting.id,
            subject=subject,
            hook=hook,
            what_happened=what_happened,
            big_story=big_story,
            why_it_matters=why_it_matters,
            translation=translation,
            public_comment_of_the_day=pc,
            la_vibes=la_vibes,
            numbers_that_matter=numbers or ["No headline numbers today — keep the receipts handy anyway."],
            whats_next=whats_next,
            closing=closing,
        )

    # -- helpers ------------------------------------------------------------
    @staticmethod
    def _subjectify(title: str) -> str:
        words = title.rstrip(".").split()
        short = " ".join(words[:8])
        return short if len(words) <= 8 else short + "…"

    @staticmethod
    def _first_sentence(text: str) -> str:
        text = (text or "").strip()
        if not text:
            return ""
        sentence = re.split(r"(?<=[.!?])\s+", text)[0].strip()
        return sentence

    @staticmethod
    def _friendly_date(iso: str) -> str:
        return f"on {iso}" if iso else "this week"

    @staticmethod
    def _speaker_label(name: str) -> str:
        name = (name or "").strip()
        if not name or name.lower() in ("speaker", "caller", "public comment"):
            return "one Angeleno"
        return name

    @staticmethod
    def _trim_quote(text: str, max_words: int = 40) -> str:
        words = text.split()
        if len(words) <= max_words:
            return text
        return " ".join(words[:max_words]) + "…"

    @staticmethod
    def _pc_why(comment: PublicComment) -> str:
        if comment.topics:
            return f"It cut to the heart of LA's {comment.topics[0]} debate."
        return "It was the kind of comment that makes the room go quiet."

    @staticmethod
    def _vibes(agenda_items: list[AgendaItem], comment: Optional[PublicComment]) -> str:
        topics = set()
        for a in agenda_items:
            topics.update(a.topics)
        if comment:
            topics.update(comment.topics)
        if "homelessness" in topics or "housing" in topics:
            return "Housing dominated the room again — the chamber's most reliable recurring character."
        if "transportation" in topics:
            return "Transit talk meant the usual bus-lane-versus-parking standoff. Classic LA."
        if "olympics" in topics:
            return "The 2028 clock ticked a little louder in the background today."
        return "A workmanlike day in the horseshoe — gavel, motion, vote, repeat."

    def _extract_numbers(self, agenda_items, comment) -> list[str]:
        numbers: list[str] = []
        seen: set[str] = set()
        blobs = []
        for a in agenda_items:
            blobs.append((f"{a.title} {a.description} {a.what_happened}", a))
        for blob, a in blobs:
            for money in _MONEY_RE.findall(blob):
                if money not in seen:
                    seen.add(money)
                    numbers.append(f"{money} — tied to {self._subjectify(a.title)}")
            if a.vote and a.vote not in seen and _VOTE_RE.fullmatch(a.vote):
                seen.add(a.vote)
                numbers.append(f"{a.vote} — the vote on {self._subjectify(a.title)}")
            if len(numbers) >= 4:
                break
        return numbers[:4]

    # -- budget -------------------------------------------------------------
    def _enforce_budget(self, nl: Newsletter) -> Newsletter:
        if nl.word_count() <= HARD_MAX_WORDS:
            return nl
        # Trim the longest free-text fields first until under budget.
        fields = ["big_story", "public_comment_of_the_day", "why_it_matters", "la_vibes", "whats_next"]
        while nl.word_count() > HARD_MAX_WORDS:
            longest = max(fields, key=lambda f: len(getattr(nl, f).split()))
            words = getattr(nl, longest).split()
            if len(words) <= 12:
                break
            setattr(nl, longest, " ".join(words[: int(len(words) * 0.8)]).rstrip(",;") + "…")
        return nl
