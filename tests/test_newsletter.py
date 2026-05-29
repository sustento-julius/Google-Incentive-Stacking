from three_mins_local.config import HARD_MAX_WORDS
from three_mins_local.generation.newsletter import NewsletterGenerator
from three_mins_local.models import AgendaItem, Meeting, PublicComment


class _NoLLM:
    available = False


def _meeting():
    return Meeting(id="m1", title="Regular Council Meeting", date="2026-05-28", committee="City Council")


def _items():
    return [
        AgendaItem(
            item_id="24-0455",
            title="Tenant Anti-Harassment Ordinance",
            description="Penalties for landlords who shut off water. Allocates $12,000,000.",
            item_type="ordinance",
            action="adopted",
            vote="12-0",
            topics=["housing"],
            what_happened="Council approved the tenant anti-harassment ordinance on a 12-0 vote.",
            why_it_matters="It gives the city teeth against landlords who cut utilities to evict tenants.",
            what_next="It moves to implementation; departments take it from here.",
            translation="Cutting your water to force you out can now get a landlord fined.",
        )
    ]


def _comment():
    return PublicComment(
        speaker_name="MARIA GONZALEZ",
        text="My landlord shut off the hot water for three weeks. Please vote yes on 24-0455.",
        topics=["housing"],
        agenda_refs=["24-0455"],
        score=0.9,
    )


def test_template_newsletter_has_all_sections():
    nl = NewsletterGenerator(llm=_NoLLM()).generate(_meeting(), _items(), _comment())
    assert nl.subject
    assert nl.hook
    assert 1 <= len(nl.what_happened) <= 5
    assert nl.big_story
    assert nl.why_it_matters
    assert nl.translation
    assert "MARIA" in nl.public_comment_of_the_day or "Maria" in nl.public_comment_of_the_day
    assert nl.la_vibes
    assert nl.numbers_that_matter
    assert nl.whats_next
    assert nl.closing


def test_numbers_extracted_from_agenda():
    nl = NewsletterGenerator(llm=_NoLLM()).generate(_meeting(), _items(), _comment())
    joined = " ".join(nl.numbers_that_matter)
    assert "$12,000,000" in joined
    assert "12-0" in joined


def test_word_budget_enforced():
    big = _items()[0]
    big.why_it_matters = "word " * 1500  # blow past the budget
    nl = NewsletterGenerator(llm=_NoLLM()).generate(_meeting(), [big], _comment())
    assert nl.word_count() <= HARD_MAX_WORDS


def test_markdown_renders():
    nl = NewsletterGenerator(llm=_NoLLM()).generate(_meeting(), _items(), _comment())
    md = nl.to_markdown()
    assert "Public Comment of the Day" in md
    assert "Translation From Government" in md
    assert "What Actually Happened" in md
