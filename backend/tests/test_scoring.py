"""
Tests for the Mihan scoring engine — tier boundaries, the SAMA 45% DBR cap,
worst-month repayment basis, VANC (Phase 2), and demo-persona invariants.
"""
import statistics
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import FactorScores
from scoring import (
    DBR_CAP,
    LOAN_PRODUCTS,
    TIER_THRESHOLDS,
    WEIGHTS,
    calculate_score,
    calculate_score_vanc,
)
from profiles import PROFILES
from lean_simulation import generate_transactions
from factor_analysis import (
    client_diversity,
    derive_factors,
    income_stability,
    monthly_income_buckets,
)


def uniform_factors(value: float) -> FactorScores:
    """All five factors set to the same value → composite == value."""
    return FactorScores(
        expense_discipline=value,
        income_stability=value,
        client_diversity=value,
        savings_behavior=value,
        contract_verification=value,
    )


class TestWeights:
    def test_weights_sum_to_one(self):
        assert sum(WEIGHTS.values()) == pytest.approx(1.0)

    def test_composite_is_weighted_sum(self):
        factors = FactorScores(
            expense_discipline=80,
            income_stability=60,
            client_diversity=40,
            savings_behavior=20,
            contract_verification=100,
        )
        expected = 80 * 0.30 + 60 * 0.25 + 40 * 0.20 + 20 * 0.15 + 100 * 0.10
        score = calculate_score(factors, worst_month_income=10000)
        assert score.composite == pytest.approx(round(expected, 1))


class TestTierBoundaries:
    def test_exactly_75_is_green(self):
        assert calculate_score(uniform_factors(75), 10000).tier == "GREEN"

    def test_just_below_75_is_yellow(self):
        assert calculate_score(uniform_factors(74.9), 10000).tier == "YELLOW"

    def test_exactly_55_is_yellow(self):
        assert calculate_score(uniform_factors(55), 10000).tier == "YELLOW"

    def test_just_below_55_is_building(self):
        assert calculate_score(uniform_factors(54.9), 10000).tier == "BUILDING"

    def test_building_tier_gets_no_loan(self):
        score = calculate_score(uniform_factors(30), 10000)
        assert score.tier == "BUILDING"
        assert score.loan is None

    def test_thresholds_match_regulatory_spec(self):
        assert TIER_THRESHOLDS == {"GREEN": 75, "YELLOW": 55}


class TestDBRCap:
    """SAMA Responsible Lending Principles Article 14(b) — 45% of income."""

    def test_dbr_cap_is_45_percent(self):
        assert DBR_CAP == 0.45

    def test_repayment_capacity_uses_worst_month_with_haircut(self):
        score = calculate_score(uniform_factors(80), worst_month_income=9500)
        assert score.repayment_capacity == int(9500 * 0.80 * DBR_CAP)

    def test_loan_compressed_when_installment_exceeds_capacity(self):
        # Worst month so low the GREEN product's 2700/mo breaches the cap
        score = calculate_score(uniform_factors(80), worst_month_income=5000)
        capacity = int(5000 * 0.80 * DBR_CAP)  # 1800 < 2700
        assert score.loan is not None
        assert score.loan.is_dbr_compressed is True
        assert score.loan.monthly_installment == capacity
        # Amount compressed proportionally, never above the base product
        base = LOAN_PRODUCTS["GREEN"]
        assert score.loan.amount == int(base.amount * capacity / base.monthly_installment)
        assert score.loan.amount < base.amount

    def test_loan_untouched_when_installment_within_capacity(self):
        score = calculate_score(uniform_factors(80), worst_month_income=20000)
        assert score.loan == LOAN_PRODUCTS["GREEN"]
        assert score.loan.is_dbr_compressed is False


class TestVANC:
    """Phase 2: underwriting_income = μ − 1.5σ over non-zero months."""

    def test_underwriting_income_formula(self):
        incomes = [8000, 9000, 10000, 11000, 12000]
        mu = statistics.mean(incomes)
        sigma = statistics.stdev(incomes)
        score = calculate_score_vanc(uniform_factors(80), incomes)
        assert score.vanc_income == int(mu - 1.5 * sigma)
        assert score.repayment_capacity == int((mu - 1.5 * sigma) * DBR_CAP)
        assert score.worst_month_income == min(incomes)
        assert score.phase == "phase2"

    def test_zero_months_are_excluded_from_stats(self):
        with_gaps = [0, 10000, 0, 10000, 10000]
        score = calculate_score_vanc(uniform_factors(80), with_gaps)
        assert score.worst_month_income == 10000  # zeros excluded
        assert score.vanc_income == 10000  # sigma == 0

    def test_single_income_month_does_not_crash(self):
        score = calculate_score_vanc(uniform_factors(80), [7000])
        assert score.vanc_income == 7000

    def test_no_income_at_all_is_building_with_no_loan(self):
        for incomes in ([], [0, 0, 0]):
            score = calculate_score_vanc(uniform_factors(90), incomes)
            assert score.tier == "BUILDING"
            assert score.loan is None
            assert score.repayment_capacity == 0

    def test_high_volatility_cannot_go_negative(self):
        # σ large enough that μ − 1.5σ < 0 — must clamp to 0
        score = calculate_score_vanc(uniform_factors(80), [100, 20000])
        assert score.vanc_income == 0
        assert score.repayment_capacity == 0


class TestPersonas:
    """The three demo personas must land in their scripted tiers — scored
    through the real pipeline: factors derived from transaction data."""

    def _score(self, profile_id):
        p = PROFILES[profile_id]
        factors, _ = derive_factors(p)
        return calculate_score(factors, p.worst_month_income)

    def test_mohammad_is_green(self):
        assert self._score("mohammad").tier == "GREEN"

    def test_noura_is_yellow(self):
        assert self._score("noura").tier == "YELLOW"

    def test_fahad_is_building(self):
        score = self._score("fahad")
        assert score.tier == "BUILDING"
        assert score.loan is None


class TestFactorAnalysis:
    """Transaction-derived factors: CV-based stability, HHI-based diversity."""

    def test_income_gaps_are_zero_filled(self):
        # Fahad skips ~25% of months — the window must show them as zeros
        buckets = monthly_income_buckets("fahad")
        assert len(buckets) == 18
        assert any(b == 0 for b in buckets)

    def test_income_gaps_hurt_stability(self):
        # Fahad's per-payment amounts are stable; only the zero-filled
        # window exposes his real volatility (missing months)
        fahad_score, fahad_ev = income_stability("fahad")
        mohammad_score, mohammad_ev = income_stability("mohammad")
        assert fahad_ev["months_with_income"] < 18
        assert mohammad_ev["months_with_income"] == 18
        assert fahad_score < mohammad_score

    def test_diversity_reflects_client_concentration(self):
        # 1 client → HHI = 1.0 → minimum diversity
        fahad_score, fahad_ev = client_diversity("fahad")
        mohammad_score, mohammad_ev = client_diversity("mohammad")
        assert fahad_ev["hhi"] == 1.0
        assert fahad_ev["effective_clients"] == 1.0
        assert mohammad_ev["senders"] == 3
        assert fahad_score < mohammad_score

    def test_income_shares_sum_to_one(self):
        _, ev = client_diversity("mohammad")
        assert sum(ev["income_shares"].values()) == pytest.approx(1.0, abs=0.01)

    def test_derived_factors_carry_provenance(self):
        _, evidence = derive_factors(PROFILES["mohammad"])
        assert evidence["income_stability"]["provenance"] == "COMPUTED_FROM_LEAN_AIS"
        assert evidence["client_diversity"]["provenance"] == "COMPUTED_FROM_LEAN_AIS"
        assert evidence["contract_verification"]["provenance"] == "WATHQ_MINISTRY_OF_COMMERCE"

    def test_derivation_is_deterministic(self):
        f1, _ = derive_factors(PROFILES["noura"])
        f2, _ = derive_factors(PROFILES["noura"])
        assert f1 == f2


class TestLeanSimulationDeterminism:
    def test_same_profile_same_transactions(self):
        assert generate_transactions("mohammad") == generate_transactions("mohammad")

    def test_seed_is_process_stable(self):
        # crc32-based seed: first transaction amounts must be reproducible
        # across separate interpreter runs (built-in hash() is not).
        import zlib
        assert zlib.crc32(b"mohammad") == 2898070991
