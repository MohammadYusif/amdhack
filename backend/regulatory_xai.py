"""
Regulatory Explainability (XAI) — auditor-ready justifications for every
Mihan credit decision.

Regulators are tightening scrutiny of "black-box" AI underwriting: adverse
decisions must carry a meaningful, specific reason and must be shown to be
free of protected-attribute bias (SAMA Responsible Lending Principles; broad
fair-lending / ECOA-style adverse-action expectations). Mihan's scoring model
is a FIXED, PUBLISHED linear model — composite = Σ(weightᵢ × scoreᵢ) — which
means its explanations are not approximations (SHAP/LIME on a black box) but
EXACT attributions. This module turns that structural transparency into a
single decision record an auditor or credit officer can read end to end:

  principal_factors   exact per-factor contribution to the composite, ranked
  adverse_action      specific negative reasons when a loan is declined or
                      DBR-compressed (the fair-lending adverse-action notice)
  dbr_justification   the full SAMA Article 14(b) affordability arithmetic
  fairness_check      an INPUT-LEVEL fairness attestation — the model consumes
                      only cash-flow-derived behavioural factors; no protected
                      attribute (gender, nationality, age, tribe/family name,
                      marital status, region) enters the score OR the AI payload

This is deliberately NOT claimed to be a statistical disparate-impact audit —
that needs population outcome data the demo does not have. It is an input-level
attestation plus an exact factor decomposition, which is what makes a single
decision auditable. Everything here is deterministic and reproducible from the
score alone, so the record shown on stage is the record that was used.
"""
from __future__ import annotations

from models import FactorScores, MihanScore
from scoring import WEIGHTS, TIER_THRESHOLDS

FACTOR_LABELS = {
    "expense_discipline": {"ar": "انضباط المصروفات", "en": "Expense discipline"},
    "income_stability": {"ar": "استقرار الدخل", "en": "Income stability"},
    "client_diversity": {"ar": "تنوع مصادر الدخل", "en": "Income-source diversity"},
    "savings_behavior": {"ar": "سلوك الادخار", "en": "Savings behaviour"},
    "contract_verification": {"ar": "توثيق العقود", "en": "Contract verification"},
}

# Protected attributes Mihan deliberately never collects into the score or the
# AI payload. Surfaced verbatim so the fairness claim is inspectable.
PROTECTED_ATTRIBUTES = [
    {"ar": "الجنس", "en": "gender"},
    {"ar": "الجنسية", "en": "nationality"},
    {"ar": "العمر", "en": "age"},
    {"ar": "اسم العائلة / القبيلة", "en": "family / tribal name"},
    {"ar": "الحالة الاجتماعية", "en": "marital status"},
    {"ar": "المنطقة", "en": "region of residence"},
]

# A factor score at or below this is weak enough to name in an adverse-action
# notice (0-100 scale; below the YELLOW-equivalent midpoint).
ADVERSE_FACTOR_THRESHOLD = 55.0

# "Margin of transparency": a factor just ABOVE the adverse threshold
# (55 < score ≤ 65) is not adverse, but it is drifting toward it — surface it
# as a WATCH item so the officer sees the drift before it becomes a rejection.
CAUTION_FACTOR_MARGIN = 10.0
# A composite that clears the YELLOW financing line by only a few points is a
# marginal approval — flag it even though the applicant was approved.
CAUTION_COMPOSITE_MARGIN = 5.0


def _principal_factors(factors: FactorScores) -> list[dict]:
    """Exact contribution of each factor to the composite, ranked by the
    weighted points it actually added. weighted_points sum to the composite
    (pre-clamp), so the decomposition is complete, not approximate."""
    rows = []
    total_weighted = sum(getattr(factors, k) * WEIGHTS[k] for k in WEIGHTS)
    for key, weight in WEIGHTS.items():
        score = getattr(factors, key)
        weighted = round(score * weight, 2)
        rows.append({
            "factor": key,
            "label_ar": FACTOR_LABELS[key]["ar"],
            "label_en": FACTOR_LABELS[key]["en"],
            "score": round(score, 1),
            "weight_pct": round(weight * 100),
            "weighted_points": weighted,
            "contribution_pct": round(weighted / total_weighted * 100, 1) if total_weighted else 0.0,
        })
    rows.sort(key=lambda r: r["weighted_points"], reverse=True)
    return rows


def _income_basis(score: MihanScore) -> tuple[int, str, str]:
    """The income figure the DBR affordability cap is applied to, plus a label
    describing WHY that figure (VANC μ−1.5σ for Phase 2, worst-month for Phase 1)."""
    if score.phase == "phase2" and score.vanc_income is not None:
        return (
            score.vanc_income,
            "VANC underwriting income (μ − 1.5σ)",
            "دخل الاكتتاب المعدّل حسب التقلب (μ − 1.5σ)",
        )
    return (
        score.worst_month_income,
        "worst-month income (Phase 1 basis)",
        "دخل أدنى شهر (أساس المرحلة الأولى)",
    )


def _dbr_justification(score: MihanScore) -> dict:
    """The full SAMA Article 14(b) affordability arithmetic behind the offer,
    including whether the offer was compressed to stay under the cap — the
    affordability-risk flag an officer must see."""
    basis, basis_en, basis_ar = _income_basis(score)
    offered = score.loan.monthly_installment if score.loan else 0
    compressed = bool(score.loan and score.loan.is_dbr_compressed)
    headroom = score.max_installment - offered
    return {
        "income_basis_sar": basis,
        "income_basis_method_en": basis_en,
        "income_basis_method_ar": basis_ar,
        "dbr_cap_pct": round(score.dbr_cap_pct * 100),
        "max_affordable_installment_sar": score.max_installment,
        "offered_installment_sar": offered,
        "installment_headroom_sar": headroom,
        "dbr_compressed": compressed,
        "affordability_flag": (
            "OFFER_COMPRESSED_TO_DBR_CEILING" if compressed
            else "WITHIN_DBR_HEADROOM" if score.loan
            else "NO_OFFER"
        ),
        "citation_en": (
            "SAMA Responsible Lending Principles, Article 14(b) — 45% DBR ceiling "
            "for income-based (non-salary-deduction) financing."
        ),
        "citation_ar": (
            "مبادئ الإقراض المسؤول الصادرة عن ساما، المادة 14(ب) — سقف نسبة "
            "الدين إلى الدخل 45% للتمويل القائم على الدخل (غير الحسم من الراتب)."
        ),
    }


def _adverse_action(factors: FactorScores, score: MihanScore, dbr: dict) -> dict | None:
    """Fair-lending adverse-action notice: the specific principal reasons a
    loan was declined or reduced. Returned only when there is an adverse
    element (BUILDING tier, or a DBR-compressed offer). contract_verification
    is excluded — an unverified-yet contract is not the applicant's failing."""
    declined = score.loan is None
    if not declined and not dbr["dbr_compressed"]:
        return None

    weak = sorted(
        (
            {
                "factor": k,
                "label_ar": FACTOR_LABELS[k]["ar"],
                "label_en": FACTOR_LABELS[k]["en"],
                "score": round(getattr(factors, k), 1),
            }
            for k in WEIGHTS
            if k != "contract_verification"
            and getattr(factors, k) <= ADVERSE_FACTOR_THRESHOLD
        ),
        key=lambda r: r["score"],
    )

    reasons: list[dict] = []
    if declined:
        reasons.append({
            "code": "BELOW_FINANCING_THRESHOLD",
            "reason_en": (
                f"Composite score {score.composite} is below the {TIER_THRESHOLDS['YELLOW']} "
                f"minimum required for a financing offer."
            ),
            "reason_ar": (
                f"النتيجة الإجمالية {score.composite} أقل من الحد الأدنى "
                f"{TIER_THRESHOLDS['YELLOW']} المطلوب لتقديم عرض تمويل."
            ),
        })
    if dbr["dbr_compressed"]:
        reasons.append({
            "code": "DBR_AFFORDABILITY_LIMIT",
            "reason_en": (
                "Offer reduced so the monthly installment stays within the 45% DBR "
                "affordability ceiling on the underwriting income."
            ),
            "reason_ar": (
                "تم تخفيض العرض ليبقى القسط الشهري ضمن سقف القدرة على السداد "
                "بنسبة 45% من دخل الاكتتاب."
            ),
        })
    for w in weak[:3]:
        reasons.append({
            "code": f"WEAK_{w['factor'].upper()}",
            "reason_en": f"{w['label_en']} score is low ({w['score']}/100).",
            "reason_ar": f"درجة {w['label_ar']} منخفضة ({w['score']}/100).",
        })

    return {
        "is_adverse": True,
        "outcome": "DECLINED_NO_OFFER" if declined else "OFFER_REDUCED",
        "principal_reasons": reasons,
        "notice_en": (
            "This notice states the principal reasons for the credit decision, as "
            "required for meaningful adverse-action transparency. SIMAH runs in "
            "parallel and is never the sole basis for a thin-file freelancer."
        ),
        "notice_ar": (
            "يوضح هذا الإشعار الأسباب الرئيسية لقرار الائتمان بما يحقق شفافية "
            "الإجراء السلبي. يعمل تقرير سمة بالتوازي ولا يكون وحده أساس القرار "
            "للمستقل ذي الملف الائتماني المحدود."
        ),
    }


def _cautionary(factors: FactorScores, score: MihanScore) -> dict | None:
    """The margin of transparency. Independent of the adverse-action notice, so
    it surfaces even on APPROVED files: factors drifting toward the adverse
    threshold, and a composite that only marginally clears the financing line.
    Returns None when nothing is close enough to warrant a caution."""
    watch = []
    hi = ADVERSE_FACTOR_THRESHOLD + CAUTION_FACTOR_MARGIN
    for k in WEIGHTS:
        if k == "contract_verification":
            continue
        s = getattr(factors, k)
        if ADVERSE_FACTOR_THRESHOLD < s <= hi:
            watch.append({
                "code": f"WATCH_{k.upper()}",
                "label_ar": FACTOR_LABELS[k]["ar"],
                "label_en": FACTOR_LABELS[k]["en"],
                "score": round(s, 1),
                "reason_en": (
                    f"{FACTOR_LABELS[k]['en']} ({round(s, 1)}/100) is only just above the "
                    f"{ADVERSE_FACTOR_THRESHOLD:.0f} adverse threshold — monitor for drift."
                ),
                "reason_ar": (
                    f"{FACTOR_LABELS[k]['ar']} ({round(s, 1)}/100) أعلى بقليل من عتبة "
                    f"الإجراء السلبي ({ADVERSE_FACTOR_THRESHOLD:.0f}) — يُنصح بالمراقبة."
                ),
            })

    marginal = None
    yellow = TIER_THRESHOLDS["YELLOW"]
    if score.loan is not None and yellow <= score.composite < yellow + CAUTION_COMPOSITE_MARGIN:
        margin = round(score.composite - yellow, 1)
        marginal = {
            "code": "MARGINAL_APPROVAL",
            "margin_above_threshold": margin,
            "reason_en": (
                f"Composite {score.composite} clears the {yellow} financing line by only "
                f"{margin} point(s) — approve, but monitor closely."
            ),
            "reason_ar": (
                f"النتيجة الإجمالية {score.composite} تتجاوز حد التمويل {yellow} بفارق "
                f"{margin} نقطة فقط — الموافقة مع المراقبة اللصيقة."
            ),
        }

    if not watch and marginal is None:
        return None
    return {
        "has_caution": True,
        "marginal_approval": marginal,
        "watch_factors": watch,
        "notice_en": (
            "Cautionary transparency: these signals are not adverse yet, but they sit "
            "close to the decision boundary and are shown so the officer sees drift early."
        ),
        "notice_ar": (
            "شفافية تحذيرية: هذه الإشارات ليست سلبية بعد، لكنها قريبة من حد القرار "
            "وتُعرض ليطّلع الموظف على أي انحراف مبكراً."
        ),
    }


def _fairness_check() -> dict:
    """Input-level fairness attestation. Not a statistical disparate-impact
    audit (that needs population outcome data); an inspectable statement that
    no protected attribute enters the score or the AI payload, plus the
    model-transparency properties that make the decision auditable."""
    scored_inputs = [FACTOR_LABELS[k]["en"] for k in WEIGHTS]
    return {
        "attestation_type": "INPUT_LEVEL_FAIRNESS_ATTESTATION",
        "protected_attributes_used_in_score": [],
        "protected_attributes_excluded": PROTECTED_ATTRIBUTES,
        "scored_inputs": scored_inputs,
        "model_type": "transparent_fixed_weight_linear_model",
        "model_note_en": (
            "The score is a fixed, published linear combination of five "
            "cash-flow-derived behavioural factors. Weights are constant and "
            "disclosed — there are no learned parameters and no black box, so "
            "every attribution above is exact rather than approximated."
        ),
        "model_note_ar": (
            "النتيجة تركيبة خطية ثابتة ومعلنة من خمسة عوامل سلوكية مشتقة من "
            "التدفق النقدي. الأوزان ثابتة ومنشورة — لا معاملات مُتعلّمة ولا صندوق "
            "أسود، لذا كل إسناد أعلاه دقيق وليس تقريبياً."
        ),
        "ai_payload_pii_exposure": "NONE",
        "ai_payload_note_en": (
            "The AI explanation model receives only the five aggregate scores and "
            "the tier — no name, ID, transactions, or protected attribute. "
            "Verifiable at /profiles/{id}/ai-privacy-proof."
        ),
        "human_in_the_loop": True,
        "human_note_en": "No loan is auto-approved; every decision routes to a credit officer.",
    }


def build_regulatory_explainability(score: MihanScore, *, source: str = "persona") -> dict:
    """The complete auditor-ready justification for one decision. Deterministic
    and reproducible from the score object alone."""
    factors = score.factors
    dbr = _dbr_justification(score)
    decision = (
        "APPROVE_FOR_OFFICER_REVIEW" if score.loan is not None
        else "DECLINE_NO_OFFER_WITH_ROADMAP"
    )
    return {
        "source": source,
        "decision": decision,
        "composite": score.composite,
        "tier": score.tier,
        "principal_factors": _principal_factors(factors),
        "dbr_justification": dbr,
        "adverse_action": _adverse_action(factors, score, dbr),
        "cautionary": _cautionary(factors, score),
        "fairness_check": _fairness_check(),
        "auditability": {
            "deterministic": True,
            "reproducible_from": "score_object_only",
            "logged_to_sama_audit": True,
            "note_en": (
                "This record is a pure function of the score; re-running it yields "
                "the same justification, so the on-stage record is the decision record."
            ),
        },
        "standards_referenced": [
            "SAMA Responsible Lending Principles — Article 14(b) (45% DBR)",
            "SAMA Open Banking Framework (licensed activity, Mar 2026)",
            "Fair-lending adverse-action transparency (meaningful principal reasons)",
        ],
    }
