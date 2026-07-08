"""
Derives scoring factors directly from Lean AIS transaction data.

Two of the five Mihan factors are computed live from the transaction
history rather than taken from onboarding declarations:

  income_stability  — coefficient of variation (σ/μ) over a zero-filled
                      18-month income window. Months with NO income count
                      as zeros, so income gaps (the real freelancer risk)
                      inflate volatility instead of hiding in the average.
                      The CV maps to a score through calibrated bands.

  client_diversity  — Herfindahl–Hirschman Index over income per sender.
                      Score = effective number of clients (1/HHI) against
                      a 4-client benchmark: 4+ evenly-weighted clients = 100.

The remaining three factors (expense_discipline, savings_behavior,
contract_verification) come from onboarding declarations + Wathq, because
the AIS simulator only produces income-side transactions. In production the
expense factors would be derived from Lean's expense categorization the
same way. Every factor carries a `provenance` label so the UI can show
exactly which numbers were computed vs declared.
"""
import statistics
from datetime import date, timedelta

from models import FactorScores, Profile
from lean_simulation import generate_transactions

# (cv, score) anchor points — piecewise-linear calibration.
# cv ≤ 0.05 is salary-grade stability; cv ≥ 0.80 is untenable volatility.
CV_SCORE_BANDS = [(0.05, 90), (0.15, 75), (0.30, 55), (0.50, 38), (0.80, 15)]

# An applicant with 4+ evenly-weighted clients scores 100 on diversity.
DIVERSITY_CLIENT_BENCHMARK = 4

WINDOW_MONTHS = 18


def monthly_income_buckets(profile_id: str, months: int = WINDOW_MONTHS) -> list[int]:
    """Zero-filled per-month income totals over the full window.
    A month with no transactions is 0, not absent — income gaps must
    be visible to the volatility metric."""
    buckets: dict[str, int] = {}
    for tx in generate_transactions(profile_id, months):
        key = tx["date"][:7]
        buckets[key] = buckets.get(key, 0) + tx["amount"]

    today = date.today()
    keys = set()
    for offset in range(months):
        keys.add((today.replace(day=1) - timedelta(days=30 * offset)).isoformat()[:7])
    return [buckets.get(k, 0) for k in sorted(keys)]


def _banded_score(cv: float) -> float:
    if cv <= CV_SCORE_BANDS[0][0]:
        return CV_SCORE_BANDS[0][1]
    for (c1, s1), (c2, s2) in zip(CV_SCORE_BANDS, CV_SCORE_BANDS[1:]):
        if cv <= c2:
            return s1 + (s2 - s1) * (cv - c1) / (c2 - c1)
    return CV_SCORE_BANDS[-1][1]


def stability_score_from_buckets(buckets: list) -> tuple[float, dict]:
    """CV-based stability score from zero-filled monthly income buckets.
    Shared by the persona pipeline and the real-statement importer so both
    run through the exact same calibration bands."""
    mu = statistics.mean(buckets)
    if mu == 0:
        return 0.0, {"cv": None, "note": "no income in window"}
    sigma = statistics.stdev(buckets) if len(buckets) > 1 else 0.0
    cv = sigma / mu
    score = round(_banded_score(cv), 1)
    return score, {
        "method": "coefficient_of_variation",
        "window_months": len(buckets),
        "months_with_income": sum(1 for b in buckets if b > 0),
        "mean_monthly_income": int(mu),
        "std_dev": int(sigma),
        "cv": round(cv, 3),
        "score": score,
    }


def income_stability(profile_id: str) -> tuple[float, dict]:
    """Score + evidence from month-over-month income variance."""
    return stability_score_from_buckets(monthly_income_buckets(profile_id))


def diversity_score_from_totals(per_sender: dict) -> tuple[float, dict]:
    """HHI-based diversity score from income totals per sender key.
    Shared by the persona pipeline and the real-statement importer."""
    total = sum(per_sender.values())
    if total == 0:
        return 0.0, {"hhi": None, "note": "no income in window"}
    shares = {k: v / total for k, v in per_sender.items()}
    hhi = sum(s ** 2 for s in shares.values())
    effective_clients = 1 / hhi
    score = round(min(100.0, effective_clients / DIVERSITY_CLIENT_BENCHMARK * 100), 1)
    return score, {
        "method": "herfindahl_hirschman_index",
        "senders": len(per_sender),
        "income_shares": {k: round(s, 3) for k, s in shares.items()},
        "hhi": round(hhi, 3),
        "effective_clients": round(effective_clients, 2),
        "benchmark_clients": DIVERSITY_CLIENT_BENCHMARK,
        "score": score,
    }


def client_diversity(profile_id: str) -> tuple[float, dict]:
    """Score + evidence from HHI concentration across income senders."""
    per_sender: dict[str, int] = {}
    for tx in generate_transactions(profile_id):
        per_sender[tx["sender_iban"]] = per_sender.get(tx["sender_iban"], 0) + tx["amount"]
    return diversity_score_from_totals(per_sender)


def derive_factors(profile: Profile) -> tuple[FactorScores, dict]:
    """Effective factor set: transaction-derived where the data allows,
    declared otherwise. Returns the factors plus a per-factor evidence
    map (with provenance) for the behind-the-scenes panel."""
    stability_score, stability_ev = income_stability(profile.id)
    diversity_score, diversity_ev = client_diversity(profile.id)

    factors = FactorScores(
        expense_discipline=profile.factor_inputs.expense_discipline,
        income_stability=stability_score,
        client_diversity=diversity_score,
        savings_behavior=profile.factor_inputs.savings_behavior,
        contract_verification=profile.factor_inputs.contract_verification,
    )
    evidence = {
        "income_stability": {"provenance": "COMPUTED_FROM_LEAN_AIS", **stability_ev},
        "client_diversity": {"provenance": "COMPUTED_FROM_LEAN_AIS", **diversity_ev},
        "expense_discipline": {
            "provenance": "DECLARED_AT_ONBOARDING",
            "score": profile.factor_inputs.expense_discipline,
            "note": "Production: derived from Lean AIS expense categorization",
        },
        "savings_behavior": {
            "provenance": "DECLARED_AT_ONBOARDING",
            "score": profile.factor_inputs.savings_behavior,
            "note": "Production: derived from Lean AIS balance history",
        },
        "contract_verification": {
            "provenance": "WATHQ_MINISTRY_OF_COMMERCE",
            "score": profile.factor_inputs.contract_verification,
            "note": "CR status + registration age of declared clients",
        },
    }
    return factors, evidence
