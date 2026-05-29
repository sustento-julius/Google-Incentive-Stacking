from three_mins_local.processing.public_comment import (
    detect_public_comment_windows,
    extract_public_comments,
)
from three_mins_local.processing.speaker_classifier import classify_segments
from three_mins_local.processing.transcript_parser import parse_transcript

SAMPLE = (
    ">> CITY CLERK [10:00:00]: Roll call. We have a quorum.\n"
    ">> COUNCIL PRESIDENT HARRIS-DAWSON [10:01:00]: We'll begin with general public comment. You have one minute.\n"
    ">> SPEAKER (MARIA) [10:02:00]: My name is Maria and I support the tenant ordinance, please vote yes.\n"
    ">> SPEAKER (KEVIN) [10:03:00]: Kevin here, the agenda is fourteen hundred pages and I have a job.\n"
    ">> CITY CLERK [10:04:00]: Your time has expired. That concludes public comment.\n"
    ">> COUNCILMEMBER SOTO-MARTINEZ [10:05:00]: I move to adopt the ordinance.\n"
)


def _segments():
    segs = parse_transcript(SAMPLE)
    classify_segments(segs)
    return segs


def test_detects_one_window():
    windows = detect_public_comment_windows(_segments())
    assert len(windows) == 1
    start, end = windows[0]
    assert start < end


def test_extracts_only_public_speakers():
    public = extract_public_comments(_segments())
    names = {p.speaker_name for p in public}
    assert any("MARIA" in n for n in names)
    assert any("KEVIN" in n for n in names)
    # Councilmember motion after the window must not be counted.
    assert not any("SOTO-MARTINEZ" in n for n in names)


def test_filters_trivial_fragments():
    segs = parse_transcript(
        ">> COUNCIL PRESIDENT [10:00:00]: General public comment, one minute each.\n"
        ">> SPEAKER (A) [10:01:00]: Thanks.\n"
        ">> SPEAKER (B) [10:02:00]: I am here today to talk about real housing policy in my neighborhood.\n"
    )
    classify_segments(segs)
    public = extract_public_comments(segs)
    # "Thanks." is too short to count.
    assert all(len(p.text.split()) >= 4 for p in public)
