"""
Tests for regulatory_xai — auditor-ready justifications.

Invariants that must hold for the compliance claim to be honest:
  * principal-factor weighted points reconstruct the composite (exact, not approx)
  * adverse-action notice appears iff the decision is adverse (declined/compressed)
  * the fairness attestation lists NO protected attribute among scored inputs
  * the whole record is deterministic (same score -> same justification)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import FactorScores
from scoring import WEIGHTS, calculate_score, calculate_score_vanc
from regulatory_xai import (
    PROTECTED_ATTRIBUTES,
    build_regulatory_explainability,
)


def _factors(v: float) -> FactorScores:
    return FactorScores(
        expense_discipline=v, income_stability=v, client_diversity=v,
        savings_behavior=v, contract_verification=v,
    )


def test_principal_factors_reconstruct_composite():
    score = calculate_score(_factors(80), worst_month_income=12000)
    xai = build_regulatory_explainability(score)
    total = sum(r["weighted_points"] for r in xai["principal_factors"])
    # weighted points sum to the composite (pre-clamp); uniform 80 -> 80
    assert abs(total - score.composite) < 0.5
    assert len(xai["principal_factors"]) == len(WEIGHTS)


def test_principal_factors_sorted_by_contribution():
    factors = FactorScores(
        expense_discipline=90, income_stability=40, client_diversity=60,
        savings_behavior=30, contract_verification=100,
    )
    score = calculate_score(factors, worst_month_income=10000)
    xai = build_regulatory_explainability(score)
    pts = [r["weighted_points"] for r in xai["principal_factors"]]
    assert pts == sorted(pts, reverse=True)
    # contribution percentages sum to ~100
    assert abs(sum(r["contribution_pct"] for r in xai["principal_factors"]) - 100) < 1.0


def test_green_offer_has_no_adverse_action():
    score = calculate_score(_factors(85), worst_month_income=20000)
    xai = build_regulatory_explainability(score)
    assert score.loan is not None
    assert not score.loan.is_dbr_compressed
    assert xai["adverse_action"] is None
    assert xai["decision"] == "APPROVE_FOR_OFFICER_REVIEW"


def test_building_tier_emits_adverse_action():
    score = calculate_score(_factors(30), worst_month_income=4000)
    xai = build_regulatory_explainability(score)
    assert score.loan is None
    aa = xai["adverse_action"]
    assert aa is not None and aa["is_adverse"]
    assert aa["outcome"] == "DECLINED_NO_OFFER"
    codes = {r["code"] for r in aa["principal_reasons"]}
    assert "BELOW_FINANCING_THRESHOLD" in codes


def test_dbr_compression_flagged_and_adverse():
    # Green factors but a tiny income forces the installment under the DBR cap
    score = calculate_score(_factors(85), worst_month_income=3000)
    xai = build_regulatory_explainability(score)
    assert score.loan is not None and score.loan.is_dbr_compressed
    assert xai["dbr_justification"]["dbr_compressed"] is True
    assert xai["dbr_justification"]["affordability_flag"] == "OFFER_COMPRESSED_TO_DBR_CEILING"
    aa = xai["adverse_action"]
    assert aa is not None and aa["outcome"] == "OFFER_REDUCED"
    assert any(r["code"] == "DBR_AFFORDABILITY_LIMIT" for r in aa["principal_reasons"])


def test_fairness_attestation_excludes_protected_attributes():
    score = calculate_score(_factors(70), worst_month_income=10000)
    fc = build_regulatory_explainability(score)["fairness_check"]
    assert fc["protected_attributes_used_in_score"] == []
    assert fc["ai_payload_pii_exposure"] == "NONE"
    protected_en = {p["en"] for p in PROTECTED_ATTRIBUTES}
    # no protected attribute is among the scored inputs
    assert protected_en.isdisjoint(set(fc["scored_inputs"]))
    assert len(fc["protected_attributes_excluded"]) == len(PROTECTED_ATTRIBUTES)


def test_dbr_justification_uses_vanc_basis_in_phase2():
    factors = _factors(80)
    score = calculate_score_vanc(factors, [10000, 12000, 9000, 11000, 10500, 9500])
    dbr = build_regulatory_explainability(score)["dbr_justification"]
    assert dbr["income_basis_sar"] == score.vanc_income
    assert dbr["dbr_cap_pct"] == 45


def test_marginal_approval_flagged_just_above_threshold():
    # composite 57 → YELLOW (approved), but only 2 points above the 55 line
    score = calculate_score(_factors(57), worst_month_income=20000)
    xai = build_regulatory_explainability(score)
    assert score.loan is not None            # approved
    assert xai["adverse_action"] is None     # not adverse
    caut = xai["cautionary"]                  # ...but cautionary still fires
    assert caut is not None and caut["has_caution"]
    assert caut["marginal_approval"]["code"] == "MARGINAL_APPROVAL"


def test_watch_factor_between_thresholds():
    # a factor at 60 sits in the 55<score<=65 watch band
    factors = FactorScores(
        expense_discipline=90, income_stability=60, client_diversity=90,
        savings_behavior=90, contract_verification=90,
    )
    score = calculate_score(factors, worst_month_income=20000)
    caut = build_regulatory_explainability(score)["cautionary"]
    assert caut is not None
    codes = {w["code"] for w in caut["watch_factors"]}
    assert "WATCH_INCOME_STABILITY" in codes


def test_strong_profile_has_no_cautionary():
    score = calculate_score(_factors(85), worst_month_income=25000)
    assert build_regulatory_explainability(score)["cautionary"] is None


def test_deterministic():
    score = calculate_score(_factors(62), worst_month_income=8000)
    a = build_regulatory_explainability(score)
    b = build_regulatory_explainability(score)
    assert a == b
