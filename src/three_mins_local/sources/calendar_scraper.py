"""Source 1 — the LA City Clerk meeting calendar.

Scrapes https://clerk.lacity.gov/calendar for council & committee meetings,
capturing title, date, committee, agenda URL, video URL, and council-file
references.

The clerk site sits behind a CDN/WAF that blocks unattended requests in many
environments (it returns 403). To keep the whole pipeline runnable offline,
this module transparently falls back to bundled fixtures when the live fetch
fails. Set ``allow_fixtures=False`` to force a hard failure instead.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from ..config import CALENDAR_URL, FIXTURES_DIR
from ..models import Meeting

log = logging.getLogger(__name__)

_HEADERS = {
    # A realistic browser UA gets us past naive filters (not the WAF, but it
    # doesn't hurt and helps when running outside the sandbox).
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Council file numbers look like 23-0145 or 24-1100-S2.
_COUNCIL_FILE_RE = re.compile(r"\b\d{2}-\d{4}(?:-S\d+)?\b")


class CalendarScraper:
    """Fetches the meeting calendar, with a fixtures fallback."""

    def __init__(self, allow_fixtures: bool = True, timeout: int = 20):
        self.allow_fixtures = allow_fixtures
        self.timeout = timeout

    def fetch(self, limit: Optional[int] = None) -> list[Meeting]:
        meetings: list[Meeting] = []
        html = self._download()
        if html:
            try:
                meetings = self._parse_calendar_html(html)
            except Exception as exc:  # parsing is best-effort
                log.warning("Failed to parse live calendar HTML: %s", exc)

        if not meetings:
            if not self.allow_fixtures:
                raise RuntimeError(
                    "Could not retrieve the LA City Clerk calendar and fixtures "
                    "are disabled (allow_fixtures=False)."
                )
            log.info("Using bundled calendar fixtures (live fetch unavailable).")
            meetings = self._load_fixture_meetings()

        if limit is not None:
            meetings = meetings[:limit]
        return meetings

    # -- live fetch ---------------------------------------------------------
    def _download(self) -> Optional[str]:
        try:
            import requests
        except ImportError:  # pragma: no cover
            log.warning("`requests` not installed; cannot fetch live calendar.")
            return None
        try:
            resp = requests.get(CALENDAR_URL, headers=_HEADERS, timeout=self.timeout)
            if resp.status_code != 200:
                log.info("Calendar fetch returned HTTP %s; falling back.", resp.status_code)
                return None
            return resp.text
        except Exception as exc:
            log.info("Calendar fetch failed (%s); falling back.", exc)
            return None

    def _parse_calendar_html(self, html: str) -> list[Meeting]:
        """Parse the clerk calendar page into Meeting objects.

        The clerk calendar renders meetings as rows/cards linking to agenda
        pages. This parser is intentionally defensive: the markup changes, so
        we extract what we can and skip what we can't.
        """
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        meetings: list[Meeting] = []

        # Meetings typically link to an agenda detail page; anchor text holds
        # the meeting title, and a nearby date label holds the date.
        for idx, anchor in enumerate(soup.select("a[href*='agenda'], a[href*='Agenda']")):
            title = anchor.get_text(strip=True)
            if not title:
                continue
            href = anchor.get("href", "")
            # Walk up to a container that may carry a date.
            container = anchor.find_parent(["tr", "li", "div"]) or anchor
            text_blob = container.get_text(" ", strip=True)
            date = self._extract_date(text_blob)
            council_files = sorted(set(_COUNCIL_FILE_RE.findall(text_blob)))
            meetings.append(
                Meeting(
                    id=f"live-{idx}",
                    title=title,
                    date=date,
                    committee=self._guess_committee(title),
                    agenda_url=self._absolute(href),
                    council_files=council_files,
                )
            )
        return meetings

    @staticmethod
    def _absolute(href: str) -> str:
        if href.startswith("http"):
            return href
        if href.startswith("/"):
            return f"https://clerk.lacity.gov{href}"
        return href

    @staticmethod
    def _extract_date(text: str) -> str:
        m = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", text)
        if m:
            mo, day, yr = m.groups()
            if len(yr) == 2:
                yr = "20" + yr
            return f"{yr}-{int(mo):02d}-{int(day):02d}"
        return ""

    @staticmethod
    def _guess_committee(title: str) -> str:
        t = title.lower()
        if "city council" in t or "council meeting" in t:
            return "City Council"
        m = re.search(r"(.+?committee)", t)
        if m:
            return m.group(1).title()
        return ""

    # -- fixtures -----------------------------------------------------------
    def _load_fixture_meetings(self) -> list[Meeting]:
        path = FIXTURES_DIR / "meetings.json"
        data = json.loads(path.read_text())
        return [
            Meeting(
                id=m["id"],
                title=m["title"],
                date=m["date"],
                committee=m.get("committee", ""),
                agenda_url=m.get("agenda_url", ""),
                video_url=m.get("video_url", ""),
                transcript_url=m.get("transcript_url", ""),
                council_files=m.get("council_files", []),
            )
            for m in data["meetings"]
        ]
