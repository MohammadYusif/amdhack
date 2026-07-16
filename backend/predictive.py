"""
Predictive Behavioral Intelligence — a forward-looking 6-month default-risk
indicator.

Static credit assessment reads the past; financial stress usually shows up
first in *behaviour* — a deteriorating income trend, rising volatility, a
thinning affordability buffer — well before it reaches a bureau file. This
module fuses the live cash-flow dynamics Mihan already computes with the
SIMAH file status and the Wathq registry signal ("Hybrid Analysis") into a
single forward-looking default probability over the next six months.

HONESTY (this is the load-bearing part): this is NOT a black-box trained PD
model and it is NOT a statistical guarantee. It is a TRANSPARENT PARAMETRIC
early-warning indicator — a logistic function with PUBLISHED, fixed
coefficients over interpretable risk signals, each in a [0,1] risk scale. The
full decomposition (every signal value × its coefficient) is returned, so the
number is fully reproducible and inspectable. It is a decision-support signal
for a human officer, not automated adverse action and not investment advice.
"""
from __future__ import annotations

import math
import statistics

from models import FactorScores, MihanScore

HORIZON_MONTHS = 6

# Published logistic coefficients. Fixed and disclosed — no learned weights.
# z = intercept + Σ (coefficient_i × signal_i), signals in [0,1] risk scale,
# PD = 1 / (1 + e^-z). Calibrated so a strong profile lands LOW and a weak
# one ELEVATED/HIGH over a 6-month horizon.
INTERCEPT = -3.65
COEFFICIENTS = {
    "income_volatility":   1.45,
    "income_trend":        1.20,
    "client_concentration": 0.86,
    "savings_buffer":      0.99,
    "dbr_utilization":     0.86,
    "registry_risk_flag":  0.92,
}

SIGNAL_LABELS = {
    "income_volatility":    {"ar": "تقلب الدخل", "en": "Income volatility"},
    "income_trend":         {"ar": "اتجاه الدخل", "en": "Income trend"},
    "client_concentration": {"ar": "تركّز العملاء", "en": "Client concentration"},
    "savings_buffer":       {"ar": "احتياطي الادخار", "en": "Savings buffer"},
    "dbr_utilization":      {"ar": "استغلال نسبة الدين", "en": "DBR utilisation"},
    "registry_risk_flag":   {"ar": "إشارة السجل التجاري", "en": "Registry risk flag"},
}

# Default-probability bands (percent).
RISK_BANDS = [(8.0, "LOW"), (18.0, "MODERATE"), (35.0, "ELEVATED"), (float("inf"), "HIGH")]


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _trend_pct_per_month(incomes: list[int]) -> float:
    """Least-squares slope of monthly income, normalised by the mean, giving a
    fractional growth rate per month. Positive = income growing. Uses the
    zero-filled series so income gaps register as the risk they are."""
    n = len(incomes)
    if n < 2:
        return 0.0
    mean = statistics.mean(incomes)
    if mean == 0:
        return 0.0
    xs = list(range(n))
    x_mean = statistics.mean(xs)
    denom = sum((x - x_mean) ** 2 for x in xs)
    if denom == 0:
        return 0.0
    slope = sum((x - x_mean) * (y - mean) for x, y in zip(xs, incomes)) / denom
    return slope / mean


def _sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def _band(pd_pct: float) -> str:
    for threshold, label in RISK_BANDS:
        if pd_pct < threshold:
            return label
    return "HIGH"


def forward_outlook(
    monthly_incomes: list[int],
    factors: FactorScores,
    score: MihanScore,
    *,
    simah_thin: bool = False,
    has_registry_flag: bool = False,
) -> dict:
    """The 6-month forward default-risk record. Deterministic and fully
    decomposed. `monthly_incomes` is the same zero-filled series the VANC
    engine scores; `simah_thin` / `has_registry_flag` fold in the hybrid
    SIMAH + Wathq signals."""
    trend_pct = _trend_pct_per_month(monthly_incomes)

    # Each signal in a [0,1] risk scale where 0 = healthy, 1 = maximum risk.
    # DBR utilisation is only a risk ABOVE 60% of the ceiling (normal borrowing
    # is not stress); no loan = no installment risk from this facility.
    dbr_util = 0.0
    if score.loan is not None and score.max_installment > 0:
        util = score.loan.monthly_installment / score.max_installment
        dbr_util = _clamp01((util - 0.60) / 0.40)

    signals_raw = {
        # income_stability already encodes CV inversely; invert to a risk value
        "income_volatility":    _clamp01((100 - factors.income_stability) / 100),
        # only a DETERIORATING trend adds risk; flat/improving → 0.
        # ≈−6.7%/mo or steeper → maximum risk.
        "income_trend":         _clamp01(-15.0 * trend_pct),
        "client_concentration": _clamp01((100 - factors.client_diversity) / 100),
        "savings_buffer":       _clamp01((100 - factors.savings_behavior) / 100),
        "dbr_utilization":      dbr_util,
        "registry_risk_flag":   1.0 if has_registry_flag else 0.0,
    }

    z = INTERCEPT
    signal_rows = []
    for name, value in signals_raw.items():
        coef = COEFFICIENTS[name]
        contribution = round(coef * value, 3)
        z += coef * value
        signal_rows.append({
            "signal": name,
            "label_ar": SIGNAL_LABELS[name]["ar"],
            "label_en": SIGNAL_LABELS[name]["en"],
            "risk_value": round(value, 3),
            "coefficient": coef,
            "contribution": contribution,
        })
    signal_rows.sort(key=lambda r: r["contribution"], reverse=True)

    pd = _sigmoid(z)
    pd_pct = round(pd * 100, 1)

    if trend_pct > 0.015:
        trend_dir = "IMPROVING"
    elif trend_pct < -0.015:
        trend_dir = "DETERIORATING"
    else:
        trend_dir = "STABLE"

    return {
        "horizon_months": HORIZON_MONTHS,
        "default_probability_6m_pct": pd_pct,
        "risk_band": _band(pd_pct),
        "trend_direction": trend_dir,
        "trend_pct_per_month": round(trend_pct * 100, 2),
        "intercept": INTERCEPT,
        "signals": signal_rows,
        "hybrid_inputs": [
            "Lean AIS cash-flow dynamics (trend + volatility)",
            "SIMAH file status" + (" — thin (expected for freelancers)" if simah_thin else ""),
            "Wathq CR registry" + (" — risk flag present" if has_registry_flag else ""),
        ],
        "method": {
            "model_type": "transparent_parametric_logistic",
            "learned_parameters": False,
            "formula": "PD = 1 / (1 + e^-(intercept + Σ coefficientᵢ × signalᵢ))",
            "note_en": (
                "A published, fixed-coefficient logistic over interpretable "
                "behavioural risk signals — every term is disclosed above and the "
                "result is exactly reproducible. It is an early-warning "
                "decision-support signal for the credit officer, not a black-box "
                "PD model, not automated adverse action, and not a guarantee."
            ),
            "note_ar": (
                "دالة لوجستية بمعاملات ثابتة ومنشورة على إشارات مخاطر سلوكية قابلة "
                "للتفسير — كل عنصر معلن أعلاه والنتيجة قابلة لإعادة الإنتاج تماماً. "
                "هي إشارة إنذار مبكر لدعم قرار موظف الائتمان، وليست نموذجاً مغلقاً "
                "ولا قراراً آلياً ولا ضماناً."
            ),
        },
    }
