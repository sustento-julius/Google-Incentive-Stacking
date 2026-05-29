from three_mins_local.models import AgendaItem, SpeakerRole, TranscriptSegment
from three_mins_local.processing.ranker import (
    comment_of_the_day,
    rank_comments,
    score_comment,
)


def _seg(text, name="SPEAKER"):
    return TranscriptSegment(index=0, text=text, speaker_name=name, role=SpeakerRole.PUBLIC)


def test_newsworthy_topic_scores_higher_than_bland():
    hot = score_comment(_seg("My landlord shut off the water to evict tenants from affordable housing."))
    bland = score_comment(_seg("I just wanted to say the new chairs in this room are quite comfortable, thanks."))
    assert hot.score > bland.score
    assert "housing" in hot.topics


def test_agenda_reference_boosts_civic_relevance():
    with_ref = score_comment(
        _seg("Please vote yes on council file 24-0455, the tenant ordinance."),
        agenda_files={"24-0455"},
    )
    without = score_comment(_seg("Please vote yes on the tenant ordinance someday."))
    assert with_ref.score_breakdown["civic_relevance"] > without.score_breakdown["civic_relevance"]
    assert "24-0455" in with_ref.agenda_refs


def test_emotional_cues_register():
    c = score_comment(_seg("Two hundred beds is not a plan, it is a press release. Do better. [applause]"))
    assert c.score_breakdown["emotional"] > 0


def test_rank_orders_and_picks_top():
    segs = [
        _seg("The agenda PDF is too long and I have a job."),
        _seg("My landlord cut the heat to evict us from our affordable apartment, vote yes on 24-0455.", "MARIA"),
    ]
    ranked = rank_comments(segs, [AgendaItem(item_id="24-0455", title="Tenant ordinance", topics=["housing"])])
    top = comment_of_the_day(ranked)
    assert top is not None
    assert top.speaker_name == "MARIA"
    assert ranked[0].score >= ranked[1].score


def test_empty_returns_none():
    assert comment_of_the_day([]) is None
