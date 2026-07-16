"""
Tests for predictive.py — the forward-looking 6-month default indicator.

The indicator only earns trust if it is monotonic in the right direction,
fully decomposed (published coefficients reproduce the probability), and
deterministic. These tests pin all three, plus the persona ordering.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import FactorScores, MihanScore
from scoring import calculate_score_vanc
from factor_analysis import derive_factors, monthly_income_buckets
from profiles import PROFILES
from predictive import COEFFICIENTS, INTERCEPT, forward_outlook


def _factors(stability=70, diversity=70, savings=70, expense=70, contract=0):
    return FactorScores(
        expense_discipline=expense, income_stability=stability,
        client_diversity=diversity, savings_behavior=savings,
        contract_verification=contract,
    )


def _score(factors, loan=None, max_installment=3000):
    return MihanScore(
        composite=60.0, tier="YELLOW", factors=factors, loan=loan,
        worst_month_income=8000, repayment_capacity=max_installment,
        max_installment=max_installment, phase="phase2",
        dbr_cap_pct=0.45, vanc_income=int(max_installment / 0.45),
    )


FLAT = [10000] * 12


def test_pd_in_range_and_deterministic():
    f = _factors()
    o1 = forward_outlook(FLAT, f, _score(f))
    o2 = forward_outlook(FLAT, f, _score(f))
    assert 0.0 <= o1["default_probability_6m_pct"] <= 100.0
    assert o1 == o2


def test_decomposition_reproduces_probability():
    f = _factors(stability=50, diversity=55, savings=45)
    o = forward_outlook(FLAT, f, _score(f), has_registry_flag=True)
    z = INTERCEPT + sum(s["contribution"] for s in o["signals"])
    pd = 1.0 / (1.0 + math.exp(-z)) * 100
    assert abs(pd - o["default_probability_6m_pct"]) < 0.2
    # every published coefficient is represented exactly once
    assert {s["signal"] for s in o["signals"]} == set(COEFFICIENTS)


def test_higher_volatility_raises_pd():
    stable = _factors(stability=90)
    volatile = _factors(stability=30)
    pd_stable = forward_outlook(FLAT, stable, _score(stable))["default_probability_6m_pct"]
    pd_volatile = forward_outlook(FLAT, volatile, _score(volatile))["default_probability_6m_pct"]
    assert pd_volatile > pd_stable


def test_deteriorating_trend_raises_pd_vs_improving():
    f = _factors()
    improving = [4000, 6000, 8000, 10000, 12000, 14000]
    declining = list(reversed(improving))
    pd_up = forward_outlook(improving, f, _score(f))
    pd_down = forward_outlook(declining, f, _score(f))
    assert pd_down["default_probability_6m_pct"] > pd_up["default_probability_6m_pct"]
    assert pd_up["trend_direction"] == "IMPROVING"
    assert pd_down["trend_direction"] == "DETERIORATING"


def test_registry_flag_raises_pd():
    f = _factors()
    clean = forward_outlook(FLAT, f, _score(f), has_registry_flag=False)
    flagged = forward_outlook(FLAT, f, _score(f), has_registry_flag=True)
    assert flagged["default_probability_6m_pct"] > clean["default_probability_6m_pct"]


def test_dbr_utilization_only_bites_near_ceiling():
    from models import LoanRecommendation
    f = _factors()
    low = _score(f, loan=LoanRecommendation(amount=10000, duration_months=12, apr=10, monthly_installment=1500), max_installment=3000)
    ceiling = _score(f, loan=LoanRecommendation(amount=10000, duration_months=12, apr=10, monthly_installment=3000, is_dbr_compressed=True), max_installment=3000)
    pd_low = forward_outlook(FLAT, f, low)["default_probability_6m_pct"]
    pd_ceiling = forward_outlook(FLAT, f, ceiling)["default_probability_6m_pct"]
    # utilisation 0.5 is below the 0.60 risk threshold → no contribution
    low_dbr = next(s for s in forward_outlook(FLAT, f, low)["signals"] if s["signal"] == "dbr_utilization")
    assert low_dbr["risk_value"] == 0.0
    assert pd_ceiling > pd_low


def test_persona_ordering():
    pds = {}
    for pid in ("mohammad", "noura", "fahad"):
        prof = PROFILES[pid]
        f, _ = derive_factors(prof)
        inc = monthly_income_buckets(pid)
        sc = calculate_score_vanc(f, inc)
        pds[pid] = forward_outlook(
            inc, f, sc, simah_thin=True, has_registry_flag=(pid == "fahad")
        )["default_probability_6m_pct"]
    assert pds["mohammad"] < pds["noura"] < pds["fahad"]
    assert pds["mohammad"] < 10          # strong profile stays LOW
