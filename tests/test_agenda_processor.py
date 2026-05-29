from three_mins_local.models import AgendaItem
from three_mins_local.processing.agenda_processor import AgendaProcessor


class _NoLLM:
    available = False


def test_template_translation_uses_phrasebook():
    proc = AgendaProcessor(llm=_NoLLM())
    item = AgendaItem(
        item_id="23-1102",
        title="Mobility corridor optimization",
        description="A dedicated bus lane on Central Avenue.",
        item_type="project",
        action="continued two weeks",
    )
    [out] = proc.process([item])
    assert "bus lane" in out.translation.lower()
    assert out.what_happened
    assert out.what_next
    assert "housing" not in out.topics  # this one is transportation
    assert "transportation" in out.topics


def test_action_phrase_reflects_outcome():
    proc = AgendaProcessor(llm=_NoLLM())
    adopted = proc.process([AgendaItem(item_id="1", title="Thing", action="adopted", vote="12-0")])[0]
    continued = proc.process([AgendaItem(item_id="2", title="Other", action="continued two weeks")])[0]
    assert "approved" in adopted.what_happened.lower()
    assert "12-0" in adopted.what_happened
    assert "punted" in continued.what_happened.lower()


def test_detects_topics():
    proc = AgendaProcessor(llm=_NoLLM())
    item = proc.process([AgendaItem(item_id="3", title="Interim housing for unhoused residents")])[0]
    assert "homelessness" in item.topics or "housing" in item.topics
