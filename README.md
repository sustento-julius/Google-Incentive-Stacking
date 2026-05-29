# 3 Mins Local

**The fastest way to understand what actually happened at LA City Hall.**

3 Mins Local is a local content pipeline that monitors Los Angeles City Council
and Committee meetings, extracts public comments and agenda items, ranks them,
explains their real-world impact, and turns the whole thing into a witty,
scannable ~3-minute newsletter.

> Morning Brew for city government. The reader should finish every issue feeling:
> _"I understand what happened, why it matters, and I didn't have to sit through
> six hours of public meetings."_

**New to this / not a coder?** Open [`explainer.html`](explainer.html) in any
browser for a plain-English, visual walkthrough of what the app does, how it
works, and what you can change.

---

## What it does

```
LA City Clerk calendar
        │  (scrape; fixtures fallback)
        ▼
   Meeting list ──► Transcript (CART → else Whisper → else fixture)
                          │
                          ▼
                 Parse + classify speakers
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
 Public comment     Agenda analysis     Numbers extraction
 detection          (What happened /
        │            Why / Next /
        ▼            Translation)
 Rank → "Public            │
 Comment of the Day"       ▼
        └────────►  Newsletter generator (Gemini or templates)
                          │
                          ▼
              output/<date>_<meeting>.md  +  .json
```

Every stage **degrades gracefully**:

- The LA City Clerk site (`clerk.lacity.gov`) sits behind a WAF that blocks
  unattended requests, so the scraper falls back to bundled **fixtures** and the
  full pipeline runs offline.
- If a meeting has a **CART transcript**, it's used directly. If only **video**
  exists, audio is pulled and transcribed with **Whisper**. Otherwise a fixture
  transcript is used.
- Newsletter prose + the "Translation From Government" use **Gemini** when
  `GEMINI_API_KEY` is set; without a key it falls back to **deterministic
  templates** and still produces a complete, on-brand issue.

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # core deps
# (optional) add Gemini for richer prose:
#   export GEMINI_API_KEY=... ; see .env.example

# List the meetings on the calendar (uses fixtures offline):
python -m three_mins_local list

# Generate the newsletter for the latest meeting and print it:
python -m three_mins_local run --print

# Generate for the latest N meetings:
python -m three_mins_local run --limit 2
```

Output is written to `output/<date>_<meeting-id>.md` (the rendered newsletter)
and `.json` (full structured result, including every scored public comment).

### CLI

| Command | What it does |
| --- | --- |
| `list [--limit N]` | Show meetings captured from the calendar. |
| `run [--limit N] [--print]` | Generate newsletter(s) for the latest meeting(s). |
| `--no-fixtures` | Require live data; fail instead of falling back (won't run offline). |
| `-v` | Verbose logging (shows which source/generator was used). |

## Newsletter structure

Each issue follows the brand template: **Subject · Hook · What Actually Happened
(3–5 bullets) · Big Story · Why It Matters · Translation From Government ·
Public Comment of the Day · LA Vibes · Numbers That Matter · What's Next ·
Closing.** Target 500–700 words (hard max 900), enforced automatically.

**Voice:** smart, funny, slightly sarcastic, civic-minded — never partisan,
activist, corporate, or like a government press release. **Ethics guardrail:**
never mock ordinary residents; humor targets bureaucracy and meeting dynamics,
not individuals.

## Public Comment ranking

Comments are scored on four weighted dimensions (see
`processing/ranker.py`):

| Dimension | Signals |
| --- | --- |
| Newsworthiness (0.35) | housing, homelessness, policing, transit, Olympics, corruption, development, labor, climate, budget |
| Emotional intensity (0.20) | applause, laughter, confrontation, outrage, ALL-CAPS, `!` |
| Virality (0.20) | memorable/unusual phrasing, humor, punchy brevity |
| Civic relevance (0.25) | references active agenda items, pending votes, council files |

The top-scoring comment becomes **Public Comment of the Day**.

## Project layout

```
src/three_mins_local/
  cli.py                  # `python -m three_mins_local ...`
  pipeline.py             # end-to-end orchestration
  config.py               # settings + topic/jargon vocabularies
  models.py               # Meeting, AgendaItem, PublicComment, Newsletter, ...
  sources/
    calendar_scraper.py   # Source 1: clerk.lacity.gov calendar (+ fixtures)
    transcript_source.py  # Sources 2 & 3: CART transcript / video→Whisper
  transcription/
    whisper_transcriber.py# optional video→audio→transcript (yt-dlp + Whisper)
  processing/
    transcript_parser.py  # raw text → speaker turns
    speaker_classifier.py # councilmember / staff / clerk / public
    public_comment.py     # public-comment window + speaker detection
    ranker.py             # score + pick Comment of the Day
    agenda_processor.py    # What happened / Why / Next / Translation
  generation/
    llm.py                # Gemini wrapper (+ no-key fallback)
    prompts.py            # brand voice + prompt templates
    newsletter.py         # assemble + budget-trim the issue
  fixtures/               # sample calendar, transcripts, agendas (offline demo)
tests/                    # pytest suite (runs fully offline)
```

## Optional dependencies

- **AI generation:** `pip install google-genai` and set `GEMINI_API_KEY`.
- **Whisper transcription** (only when a meeting has video but no CART
  transcript): `pip install faster-whisper yt-dlp` and have `ffmpeg` installed.
  Configure with `TML_WHISPER_BACKEND` / `TML_WHISPER_MODEL`.

## Tests

```bash
pip install pytest
PYTHONPATH=src pytest          # or: pip install -e . && pytest
```

The suite covers transcript parsing, speaker classification, public-comment
detection, ranking, agenda translation, newsletter assembly + word budget, and
a full offline end-to-end run.

## Data sources

- LA City Clerk meeting calendar — https://clerk.lacity.gov/calendar
- Meeting video — https://www.youtube.com/@LACityClerk · https://lacity.gov/tv
- CART transcripts — https://clerk.lacity.gov/clerk-services/cps/council-committee-meetings/meeting-agendas
