from three_mins_local.processing.transcript_parser import parse_transcript


def test_parses_speaker_marker_with_timestamp():
    text = ">> COUNCIL PRESIDENT HARRIS-DAWSON [10:04:33]: Good morning, everyone."
    segs = parse_transcript(text)
    assert len(segs) == 1
    assert segs[0].speaker_name == "COUNCIL PRESIDENT HARRIS-DAWSON"
    assert segs[0].start == 10 * 3600 + 4 * 60 + 33
    assert "Good morning" in segs[0].text


def test_continuation_lines_join_previous_turn():
    text = (
        ">> SPEAKER (MARIA) [10:05:01]: My name is Maria.\n"
        "I rent in Boyle Heights.\n"
        ">> CITY CLERK: Next speaker."
    )
    segs = parse_transcript(text)
    assert len(segs) == 2
    assert "Boyle Heights" in segs[0].text
    assert segs[1].speaker_name == "CITY CLERK"


def test_timestamp_first_format():
    text = "[13:00:30] CITY CLERK: This is the meeting of the Housing Committee."
    segs = parse_transcript(text)
    assert len(segs) == 1
    assert segs[0].start == 13 * 3600 + 30
    assert segs[0].speaker_name == "CITY CLERK"


def test_blank_lines_ignored():
    text = "\n\n>> CHAIR: Order.\n\n"
    segs = parse_transcript(text)
    assert len(segs) == 1
