import statistics
from models import FactorScores, LoanRecommendation, MihanScore

WEIGHTS = {
    "expense_discipline":    0.30,   # was 0.35
    "income_stability":      0.25,   # was 0.30
    "client_diversity":      0.20,   # unchanged
    "savings_behavior":      0.15,   # unchanged
    "contract_verification": 0.10,   # NEW
}

TIER_THRESHOLDS = {"GREEN": 75, "YELLOW": 55}

# 45% — SAMA Responsible Lending Principles Article 14(b)
# Applies to income-based non-salary-deduction financing (freelancers).
# 33.33% applies only to employer payroll deductions — NOT applicable here.
DBR_CAP = 0.45

LOAN_PRODUCTS = {
    "GREEN":    LoanRecommendation(amount=60000, duration_months=24, apr=8.2,  monthly_installment=2700),
    "YELLOW":   LoanRecommendation(amount=25000, duration_months=18, apr=11.5, monthly_installment=1550),
    "BUILDING": None,
}


def _composite(factors: FactorScores) -> float:
    raw = (
        factors.expense_discipline    * WEIGHTS["expense_discipline"]
        + factors.income_stability    * WEIGHTS["income_stability"]
        + factors.client_diversity    * WEIGHTS["client_diversity"]
        + factors.savings_behavior    * WEIGHTS["savings_behavior"]
        + factors.contract_verification * WEIGHTS["contract_verification"]
    )
    return min(100.0, max(0.0, round(raw, 1)))


def _tier(composite: float) -> str:
    if composite >= TIER_THRESHOLDS["GREEN"]:
        return "GREEN"
    elif composite >= TIER_THRESHOLDS["YELLOW"]:
        return "YELLOW"
    return "BUILDING"


def calculate_score(factors: FactorScores, worst_month_income: int) -> MihanScore:
    composite = _composite(factors)
    tier = _tier(composite)
    repayment_capacity = int(worst_month_income * 0.80 * DBR_CAP)

    return MihanScore(
        composite=composite,
        tier=tier,
        factors=factors,
        loan=LOAN_PRODUCTS[tier],
        worst_month_income=worst_month_income,
        repayment_capacity=repayment_capacity,
        max_installment=repayment_capacity,
        dbr_cap_pct=DBR_CAP,
    )


def calculate_score_vanc(
    factors: FactorScores,
    monthly_incomes: list[int],  # 12-month income list
) -> MihanScore:
    """Phase 2 formula: underwriting_income = μ - (1.5 × σ)"""
    non_zero = [x for x in monthly_incomes if x > 0]
    mu = statistics.mean(non_zero)
    sigma = statistics.stdev(non_zero) if len(non_zero) > 1 else 0
    underwriting_income = max(0, mu - (1.5 * sigma))
    repayment_capacity = int(underwriting_income * DBR_CAP)
    worst_month = min(non_zero)

    composite = _composite(factors)
    tier = _tier(composite)

    return MihanScore(
        composite=composite,
        tier=tier,
        factors=factors,
        loan=LOAN_PRODUCTS[tier],
        worst_month_income=worst_month,
        repayment_capacity=repayment_capacity,
        max_installment=repayment_capacity,
        phase="phase2",
        dbr_cap_pct=DBR_CAP,
        vanc_income=int(underwriting_income),
    )
