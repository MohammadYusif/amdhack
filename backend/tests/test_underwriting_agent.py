"""
Tests for underwriting_agent — the autonomous recommendation + grounded chat.

The privacy guarantee is the load-bearing invariant: the agent context must be
a clean zero-PII aggregate (no raw transactions, no long digit runs). Beyond
that we pin that the draft is decisive and appropriate to the tier, and that
the chat answers are grounded in the right context slice.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import FactorScores, LoanRecommendation
from scoring import calculate_score, calculate_score_vanc
from factor_analysis import derive_factors, monthly_income_buckets
from profiles import PROFILES
from predictive import forward_outlook
from underwriting_agent import (
    answer_question,
    assert_context_clean,
    build_agent_context,
    draft_recommendation,
)


def _persona_context(profile_id: str) -> dict:
    prof = PROFILES[profile_id]
    factors, _ = derive_factors(prof)
    inc = monthly_income_buckets(profile_id)
    score = calculate_score_vanc(factors, inc)
    outlook = forward_outlook(inc, factors, score, simah_thin=True,
                              has_registry_flag=(profile_id == "fahad"))
    return build_agent_context(score, outlook)


def test_context_is_pii_clean_for_all_personas():
    for pid in ("mohammad", "noura", "fahad"):
        ctx = _persona_context(pid)
        assert_context_clean(ctx)  # must not raise
        assert "transactions" not in ctx
        assert "loan" in ctx and "factors" in ctx


def test_context_guard_rejects_leaked_raw_data():
    ctx = _persona_context("mohammad")
    ctx["transactions"] = [{"amount": 1}]  # simulate a leak
    with pytest.raises(ValueError):
        assert_context_clean(ctx)


def test_context_guard_rejects_long_digit_run():
    ctx = _persona_context("mohammad")
    ctx["note"] = "IBAN SA0380000000608010167519"
    with pytest.raises(ValueError):
        assert_context_clean(ctx)


def test_draft_declines_building_tier():
    ctx = _persona_context("fahad")
    draft = draft_recommendation(ctx)
    assert draft["action"] == "DECLINE_ISSUE_ROADMAP"
    assert draft["source"] == "template"
    assert draft["rationale_en"]  # non-empty


def test_draft_green_is_approve_high_confidence():
    factors = FactorScores(expense_discipline=85, income_stability=90,
                           client_diversity=85, savings_behavior=80, contract_verification=80)
    score = calculate_score(factors, worst_month_income=25000)
    outlook = forward_outlook([25000] * 12, factors, score)
    draft = draft_recommendation(build_agent_context(score, outlook))
    assert draft["action"] in ("APPROVE_ROUTE_TO_OFFICER", "APPROVE_WITH_CONDITIONS")


def test_draft_compressed_attaches_escrow_condition():
    factors = FactorScores(expense_discipline=85, income_stability=90,
                           client_diversity=85, savings_behavior=80, contract_verification=80)
    score = calculate_score(factors, worst_month_income=3000)  # forces DBR compression
    assert score.loan is not None and score.loan.is_dbr_compressed
    outlook = forward_outlook([3000] * 12, factors, score)
    draft = draft_recommendation(build_agent_context(score, outlook))
    assert draft["action"] == "APPROVE_WITH_CONDITIONS"
    assert any("escrow" in c["en"].lower() for c in draft["conditions"])


def test_ask_dbr_intent_grounded():
    ctx = _persona_context("noura")
    r = answer_question("What's the DBR / affordability position?", ctx)
    assert r["grounding"] == ["dbr"]
    assert "45%" in r["answer_en"]


def test_ask_forward_risk_intent_grounded():
    ctx = _persona_context("fahad")
    r = answer_question("What is the biggest risk over the next 6 months?", ctx)
    assert r["grounding"] == ["forward"]
    assert "%" in r["answer_en"]


def test_ask_fairness_intent_grounded():
    ctx = _persona_context("mohammad")
    r = answer_question("Is this decision bias-checked and fair?", ctx)
    assert r["grounding"] == ["fairness"]
    assert "NONE" in r["answer_en"]


def test_ask_why_declined_uses_adverse_reasons():
    ctx = _persona_context("fahad")
    r = answer_question("Why was this declined?", ctx)
    assert r["grounding"] == ["adverse_reasons"]
    assert len(r["answer_en"]) > 0


def test_ask_fallback_is_grounded_summary():
    ctx = _persona_context("mohammad")
    r = answer_question("tell me something", ctx)
    assert r["grounding"] == ["summary"]
    assert ctx["tier"] in r["answer_en"]


def test_multi_intent_composes_dbr_and_forward():
    ctx = _persona_context("noura")
    r = answer_question("What's the DBR position and the 6-month default risk?", ctx)
    # both grounding sources present, in intent order
    assert "dbr" in r["grounding"] and "forward" in r["grounding"]
    assert "45%" in r["answer_en"] and "%" in r["answer_en"]


def test_what_if_curveball_is_grounded_and_no_invented_numbers():
    ctx = _persona_context("fahad")
    r = answer_question("What if they suddenly land a new high-value contract?", ctx)
    assert "what_if" in r["grounding"]
    assert "Directional" in r["answer_en"]
    # it must reference the real current composite, not a fabricated future score
    assert str(ctx["composite"]) in r["answer_en"]


def test_single_intent_grounding_unchanged():
    ctx = _persona_context("mohammad")
    assert answer_question("affordability / DBR?", ctx)["grounding"] == ["dbr"]


def test_context_exposes_volatility_block():
    ctx = _persona_context("noura")
    vol = ctx["volatility"]
    assert vol is not None
    assert vol["sigma_sar"] is not None
    assert vol["conservatism_haircut_sar"] == vol["mean_monthly_income_sar"] - vol["underwriting_income_sar"]


def test_stability_answer_cites_sigma():
    ctx = _persona_context("fahad")
    r = answer_question("Why is income stability penalized — what's the volatility?", ctx)
    assert "volatility" in r["grounding"]
    assert "σ" in r["answer_en"]


def test_answers_are_deterministic():
    ctx = _persona_context("noura")
    a = answer_question("forward risk?", ctx)
    b = answer_question("forward risk?", ctx)
    assert a == b


# ---------------------------------------------------------------------------
# Arabic parity — the dashboard is Arabic-first, and the UI's own suggestion
# chips are Arabic. Screenshot QA caught 3 of the 4 chips falling back to the
# generic summary (singular "خطر" vs plural keyword "مخاطر"; the shadda in
# "التحيّز" defeating raw substring match; broken plural "الشروط" vs "شرط"),
# answered in English. These pin routing AND answer language per chip.
# ---------------------------------------------------------------------------

ARABIC_CHIPS = [  # (the exact chip text the UI offers, expected primary grounding)
    ("ما وضع القدرة على السداد / نسبة الدين؟", "dbr"),
    ("أكبر خطر خلال الأشهر الستة القادمة؟", "forward"),
    ("هل القرار خاضع لفحص التحيّز وعادل؟", "fairness"),
    ("ما الشروط التي تقترحها؟", "conditions"),
]


def _has_arabic(text: str) -> bool:
    return any("؀" <= c <= "ۿ" for c in text)


@pytest.mark.parametrize("question,intent", ARABIC_CHIPS)
def test_arabic_chip_routes_to_intent_not_summary(question, intent):
    ctx = _persona_context("fahad")
    r = answer_question(question, ctx)
    assert intent in r["grounding"], f"chip fell back to {r['grounding']}"
    assert r["grounding"] != ["summary"]


@pytest.mark.parametrize("question,intent", ARABIC_CHIPS)
def test_arabic_chip_gets_arabic_answer(question, intent):
    ctx = _persona_context("fahad")
    r = answer_question(question, ctx)
    assert r["answer_ar"], "template answers must always carry answer_ar"
    assert _has_arabic(r["answer_ar"])


def test_english_and_arabic_chip_route_identically():
    ctx = _persona_context("fahad")
    pairs = [
        ("Biggest risk over the next 6 months?", "أكبر خطر خلال الأشهر الستة القادمة؟"),
        ("Is this decision bias-checked and fair?", "هل القرار خاضع لفحص التحيّز وعادل؟"),
        ("What conditions would you attach?", "ما الشروط التي تقترحها؟"),
    ]
    for en, ar in pairs:
        assert answer_question(en, ctx)["grounding"] == answer_question(ar, ctx)["grounding"]


def test_diacritics_and_alef_variants_do_not_break_matching():
    ctx = _persona_context("noura")
    # shadda + alef-hamza forms of the same fairness question
    assert "fairness" in answer_question("هل يوجد تحيّز؟", ctx)["grounding"]
    assert "fairness" in answer_question("هل يوجد تحيز؟", ctx)["grounding"]
    assert "forward" in answer_question("أكبر الأخطار؟", ctx)["grounding"]


def test_fallback_summary_is_bilingual():
    ctx = _persona_context("noura")
    r = answer_question("طقس الرياض اليوم", ctx)  # genuinely off-topic
    assert r["grounding"] == ["summary"]
    assert r["answer_ar"] and _has_arabic(r["answer_ar"])
