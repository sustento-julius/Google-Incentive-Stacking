"""End-to-end pipeline test running fully offline on bundled fixtures."""
from three_mins_local.config import HARD_MAX_WORDS, Settings
from three_mins_local.pipeline import Pipeline


def _offline_pipeline():
    # Force template mode regardless of any ambient GEMINI_API_KEY.
    settings = Settings(gemini_api_key="")
    return Pipeline(settings=settings, allow_fixtures=True)


def test_lists_fixture_meetings():
    meetings = _offline_pipeline().list_meetings()
    assert len(meetings) >= 2
    assert meetings[0].id == "council-2026-05-28"


def test_full_run_produces_complete_newsletter():
    pipe = _offline_pipeline()
    meeting = pipe.list_meetings()[0]
    result = pipe.run_meeting(meeting)

    nl = result.newsletter
    assert nl.word_count() <= HARD_MAX_WORDS
    assert result.transcript_segments > 5
    assert result.public_comments, "should detect public comments from the fixture"
    assert result.top_comment is not None

    # The hottest comment should be a housing/homelessness one from the fixture.
    assert result.top_comment.score > 0
    assert any(t in {"housing", "homelessness"} for t in result.top_comment.topics)

    # Agenda analysis populated.
    assert meeting.agenda_items
    assert all(a.what_happened and a.translation for a in meeting.agenda_items)


def test_committee_meeting_runs():
    pipe = _offline_pipeline()
    committee = [m for m in pipe.list_meetings() if "Committee" in m.committee][0]
    result = pipe.run_meeting(committee)
    assert result.newsletter.subject
    assert result.public_comments


def test_save_writes_files(tmp_path):
    pipe = _offline_pipeline()
    result = pipe.run_meeting(pipe.list_meetings()[0])
    paths = pipe.save(result, output_dir=tmp_path)
    assert paths["markdown"].exists()
    assert paths["json"].exists()
    assert "3 Mins Local" in paths["markdown"].read_text()
