from three_mins_local.models import SpeakerRole
from three_mins_local.processing.speaker_classifier import classify_label


def test_councilmember():
    assert classify_label(">> COUNCILMEMBER SOTO-MARTINEZ") == SpeakerRole.COUNCILMEMBER
    assert classify_label("COUNCIL PRESIDENT HARRIS-DAWSON") == SpeakerRole.COUNCILMEMBER


def test_clerk_beats_other_titles():
    # "city clerk" must classify as CLERK, not STAFF.
    assert classify_label(">> CITY CLERK") == SpeakerRole.CLERK


def test_staff():
    assert classify_label("CITY ATTORNEY RODRIGUEZ") == SpeakerRole.STAFF
    assert classify_label("GENERAL MANAGER DELGADO") == SpeakerRole.STAFF


def test_public_label():
    assert classify_label(">> SPEAKER (MARIA GONZALEZ)") == SpeakerRole.PUBLIC
    assert classify_label("CALLER") == SpeakerRole.PUBLIC


def test_unknown():
    assert classify_label("XYZ") == SpeakerRole.UNKNOWN
