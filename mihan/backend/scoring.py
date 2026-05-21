from models import FactorScores, LoanRecommendation, MihanScore

WEIGHTS = {
    "expense_discipline": 0.35,
    "income_stability": 0.30,
    "client_diversity": 0.20,
    "savings_behavior": 0.15,
}

TIER_THRESHOLDS = {"GREEN": 75, "YELLOW": 55}

LOAN_PRODUCTS = {
    "GREEN":  LoanRecommendation(amount=60000, duration_months=24, apr=8.2,  monthly_installment=2800),
    "YELLOW": LoanRecommendation(amount=25000, duration_months=18, apr=11.5, monthly_installment=1600),
    "BUILDING": None,
}


def calculate_score(factors: FactorScores, worst_month_income: int) -> MihanScore:
    composite = round(
        factors.expense_discipline * WEIGHTS["expense_discipline"]
        + factors.income_stability  * WEIGHTS["income_stability"]
        + factors.client_diversity  * WEIGHTS["client_diversity"]
        + factors.savings_behavior  * WEIGHTS["savings_behavior"],
        1,
    )
    composite = min(100.0, max(0.0, composite))

    if composite >= TIER_THRESHOLDS["GREEN"]:
        tier = "GREEN"
    elif composite >= TIER_THRESHOLDS["YELLOW"]:
        tier = "YELLOW"
    else:
        tier = "BUILDING"

    repayment_capacity = int(worst_month_income * 0.80)

    return MihanScore(
        composite=composite,
        tier=tier,
        factors=factors,
        loan=LOAN_PRODUCTS[tier],
        worst_month_income=worst_month_income,
        repayment_capacity=repayment_capacity,
    )
