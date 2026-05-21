from pydantic import BaseModel
from typing import Optional


class FactorScores(BaseModel):
    expense_discipline: float
    income_stability: float
    client_diversity: float
    savings_behavior: float
    contract_verification: float  # NEW — 10% weight


class LoanRecommendation(BaseModel):
    amount: int
    duration_months: int
    apr: float
    monthly_installment: int


class MihanScore(BaseModel):
    composite: float
    tier: str  # "GREEN" | "YELLOW" | "BUILDING"
    factors: FactorScores
    loan: Optional[LoanRecommendation]
    worst_month_income: int
    repayment_capacity: int
    max_installment: int      # repayment_capacity (alias for clarity)
    phase: str = "phase1"
    dbr_cap_pct: float = 0.45
    vanc_income: Optional[int] = None


class Profile(BaseModel):
    id: str
    name_ar: str
    name_en: str
    profession_ar: str
    profession_en: str
    avatar_initials: str
    factor_inputs: FactorScores
    worst_month_income: int
    months_of_history: int
    client_count: int
    largest_client_pct: int
    monthly_savings_pct: int


class AuditEntry(BaseModel):
    id: int
    timestamp: str
    profile_id: str
    profile_name: str
    composite_score: float
    tier: str
    event: str
    details: str


class HumanReviewRequest(BaseModel):
    notes: str = ""
