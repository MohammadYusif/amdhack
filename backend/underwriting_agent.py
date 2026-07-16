"""
Autonomous Underwriting Agent.

The moment an assessment exists, this agent drafts a concise, decisive
"Underwriter Recommendation" so the credit officer starts from a synthesized
opinion instead of a wall of raw factor tables — and it answers follow-up
questions in a chat interface, grounded in the assessment.

PRIVACY (non-negotiable, same guarantee as the rest of Mihan): the agent only
ever sees a ZERO-PII AGGREGATE CONTEXT — composite, tier, the five factor
scores, the DBR arithmetic, the forward-outlook probability and its signal
decomposition, and the adverse-action reason codes. It never receives raw
transactions, counterparties, names, account numbers, or the SIMAH report.
build_agent_context() assembles that aggregate, and assert_context_clean()
fail-closes if a long digit run or a forbidden raw-data key ever leaks in.
The optional live-Claude path is handed the SAME aggregate — so turning the
model on changes nothing about what leaves the process.

Both capabilities are deterministic by default (template answers) with an
opt-in live-Claude call that falls back to the template on any failure, so the
demo never blocks on network or quota.
"""
from __future__ import annotations

import os
import re

from models import MihanScore
from regulatory_xai import build_regulatory_explainability

_DIGIT_RUN = re.compile(r"\d{7,}")
# Keys that would signal raw, non-aggregated data leaking into the agent context.
_FORBIDDEN_KEYS = {"transactions", "counterparty", "name_ar", "name_en", "iban",
                   "national_id", "sender_iban", "account", "raw"}

CLAUDE_MODEL = "claude-sonnet-4-6"
LIVE_TIMEOUT_SECONDS = 12

AGENT_SYSTEM_PROMPT = (
    "You are an assistant credit underwriter for a Saudi bank. You are given an "
    "ANONYMIZED, aggregate assessment (scores, DBR arithmetic, a forward-looking "
    "default probability, and adverse-action reason codes) — never any personal "
    "data or raw transactions. Answer the officer's question concisely and only "
    "from the aggregate provided. Never invent figures. Be decisive but always "
    "defer the final decision to the human officer."
)


# ---------------------------------------------------------------------------
# Zero-PII aggregate context
# ---------------------------------------------------------------------------

def build_agent_context(score: MihanScore, outlook: dict) -> dict:
    """Assemble the aggregate context the agent reasons over. Pure aggregates —
    no raw data by construction. `outlook` is a predictive.forward_outlook()
    result; the XAI record is derived from the score."""
    xai = build_regulatory_explainability(score)
    dbr = xai["dbr_justification"]
    loan = score.loan
    return {
        "tier": score.tier,
        "composite": score.composite,
        "decision": xai["decision"],
        "factors": score.factors.model_dump(),
        "principal_factors": [
            {"label_en": f["label_en"], "label_ar": f["label_ar"],
             "score": f["score"], "contribution_pct": f["contribution_pct"]}
            for f in xai["principal_factors"]
        ],
        "dbr": {
            "income_basis_sar": dbr["income_basis_sar"],
            "cap_pct": dbr["dbr_cap_pct"],
            "max_installment_sar": dbr["max_affordable_installment_sar"],
            "offered_installment_sar": dbr["offered_installment_sar"],
            "headroom_sar": dbr["installment_headroom_sar"],
            "compressed": dbr["dbr_compressed"],
        },
        "adverse_reasons": (
            [{"code": r["code"], "reason_en": r["reason_en"], "reason_ar": r["reason_ar"]}
             for r in xai["adverse_action"]["principal_reasons"]]
            if xai["adverse_action"] else []
        ),
        "fairness": {
            "protected_attributes_used": len(xai["fairness_check"]["protected_attributes_used_in_score"]),
            "ai_pii_exposure": xai["fairness_check"]["ai_payload_pii_exposure"],
        },
        # Volatility transparency — the μ/σ behind the conservative VANC income,
        # so the agent can explain WHY income stability underwrites down.
        "volatility": (
            {
                "mean_monthly_income_sar": score.vanc_mean,
                "sigma_sar": score.vanc_sigma,
                "underwriting_income_sar": score.vanc_income,
                "conservatism_haircut_sar": score.vanc_mean - score.vanc_income,
                "formula": "underwriting_income = μ − 1.5σ",
            }
            if score.vanc_mean is not None and score.vanc_income is not None
            else None
        ),
        "forward": {
            "pd_6m_pct": outlook["default_probability_6m_pct"],
            "band": outlook["risk_band"],
            "trend": outlook["trend_direction"],
            "trend_pct_per_month": outlook["trend_pct_per_month"],
            "top_signals": [
                {"label_en": s["label_en"], "label_ar": s["label_ar"],
                 "contribution": s["contribution"]}
                for s in outlook["signals"][:3]
            ],
        },
        "loan": (
            {"amount_sar": loan.amount, "duration_months": loan.duration_months,
             "apr": loan.apr, "installment_sar": loan.monthly_installment}
            if loan else None
        ),
    }


def assert_context_clean(context: dict) -> None:
    """Fail-closed guard: raise if the aggregate context ever contains a long
    digit run (an account/ID/ref) or a forbidden raw-data key."""
    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if str(k).lower() in _FORBIDDEN_KEYS:
                    raise ValueError(f"agent context leak: forbidden key '{k}'")
                walk(v)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                walk(v)
        elif isinstance(obj, str):
            if _DIGIT_RUN.search(obj):
                raise ValueError("agent context leak: long digit run in a string field")

    walk(context)


# ---------------------------------------------------------------------------
# Auto-drafted recommendation
# ---------------------------------------------------------------------------

def _conditions(context: dict) -> list[dict]:
    """Risk-appropriate covenants the officer can attach."""
    conds: list[dict] = []
    band = context["forward"]["band"]
    if context["dbr"]["compressed"]:
        conds.append({
            "en": "Two-month escrow holdback on first disbursement (offer sits at the DBR ceiling).",
            "ar": "احتجاز ضماني بقيمة شهرين عند الصرف الأول (العرض عند سقف نسبة الدين).",
        })
    if band in ("ELEVATED", "HIGH"):
        conds.append({
            "en": "Route freelance income through the Alinma account and re-underwrite every quarter.",
            "ar": "توجيه دخل العمل الحر عبر حساب الإنماء وإعادة الاكتتاب كل ربع سنة.",
        })
    if context["forward"]["trend"] == "DETERIORATING":
        conds.append({
            "en": "Set an income-drop alert; pause further limit increases while the trend is negative.",
            "ar": "تفعيل تنبيه انخفاض الدخل؛ إيقاف أي زيادة في الحد أثناء الاتجاه السلبي.",
        })
    return conds


def draft_recommendation(context: dict, *, allow_live: bool = False) -> dict:
    """Synthesize the assessment into a decisive underwriter recommendation.
    Deterministic template by default; opt-in live Claude with template fallback."""
    assert_context_clean(context)
    approved = context["loan"] is not None
    compressed = context["dbr"]["compressed"]
    band = context["forward"]["band"]
    pd = context["forward"]["pd_6m_pct"]
    top = context["principal_factors"][0] if context["principal_factors"] else None

    if not approved:
        action = "DECLINE_ISSUE_ROADMAP"
        head_en = "Decline for now — issue the improvement roadmap."
        head_ar = "الرفض حالياً — مع إصدار خارطة التحسين."
    elif compressed or band in ("ELEVATED", "HIGH"):
        action = "APPROVE_WITH_CONDITIONS"
        head_en = "Approve with conditions — route to officer."
        head_ar = "الموافقة بشروط — مع الإحالة إلى موظف الائتمان."
    else:
        action = "APPROVE_ROUTE_TO_OFFICER"
        head_en = "Approve — route to officer for sign-off."
        head_ar = "الموافقة — مع الإحالة إلى موظف الائتمان للاعتماد."

    rationale_en = [f"Composite {context['composite']} → {context['tier']} tier."]
    rationale_ar = [f"النتيجة الإجمالية {context['composite']} ← تصنيف {context['tier']}."]
    if top:
        rationale_en.append(f"Strongest driver: {top['label_en']} ({top['score']}/100).")
        rationale_ar.append(f"أقوى عامل: {top['label_ar']} ({top['score']}/100).")
    rationale_en.append(
        f"Forward 6-month default probability {pd}% ({band}), income trend {context['forward']['trend'].lower()}.")
    rationale_ar.append(
        f"احتمالية التعثّر خلال 6 أشهر {pd}% ({band})، واتجاه الدخل {context['forward']['trend']}.")
    if context["dbr"]["compressed"]:
        rationale_en.append("Offer was compressed to stay within the 45% DBR ceiling.")
        rationale_ar.append("تم تخفيض العرض للبقاء ضمن سقف نسبة الدين 45%.")
    if context["adverse_reasons"]:
        rationale_en.append(f"{len(context['adverse_reasons'])} adverse-action reason(s) on file.")
        rationale_ar.append(f"يوجد {len(context['adverse_reasons'])} سبب للإجراء السلبي.")

    confidence = "HIGH" if (approved and band == "LOW" and not compressed) else "MEDIUM"

    draft = {
        "action": action,
        "headline_en": head_en,
        "headline_ar": head_ar,
        "rationale_en": rationale_en,
        "rationale_ar": rationale_ar,
        "conditions": _conditions(context),
        "confidence": confidence,
        "source": "template",
        "disclaimer_en": "Decision-support draft — the human credit officer makes the final decision.",
        "disclaimer_ar": "مسودة لدعم القرار — القرار النهائي يتخذه موظف الائتمان.",
    }
    if allow_live:
        live = _live_draft(context)
        if live:
            draft["headline_en"] = live
            draft["source"] = "claude-live"
    return draft


# ---------------------------------------------------------------------------
# Grounded chat Q&A
# ---------------------------------------------------------------------------

def _match(question: str, keywords: tuple[str, ...]) -> bool:
    q = question.lower()
    return any(k in q for k in keywords)


def answer_question(question: str, context: dict, *, allow_live: bool = False) -> dict:
    """Answer an officer's question, grounded strictly in the aggregate context.
    Deterministic intent match by default; opt-in live Claude with fallback."""
    assert_context_clean(context)
    q = (question or "").strip()

    if allow_live:
        live = _live_answer(q, context)
        if live:
            return {"answer_en": live, "grounding": ["forward", "dbr", "principal_factors"],
                    "source": "claude-live"}

    fwd = context["forward"]
    dbr = context["dbr"]

    if _match(q, ("dbr", "install", "afford", "capacity", "قسط", "نسبة الدين", "سداد", "طاقة")):
        ans = (
            f"Affordability is set by SAMA Art. 14(b): 45% of the {dbr['income_basis_sar']:,} SAR "
            f"underwriting income = {dbr['max_installment_sar']:,} SAR max installment. "
            f"Offered {dbr['offered_installment_sar']:,} SAR, headroom {dbr['headroom_sar']:,} SAR"
            + (" — offer is compressed to the ceiling." if dbr["compressed"] else ".")
        )
        return {"answer_en": ans, "grounding": ["dbr"], "source": "template"}

    if _match(q, ("risk", "default", "6 month", "forward", "future", "next", "outlook",
                  "تعثر", "مخاطر", "مستقبل", "احتمال")):
        sig = fwd["top_signals"][0] if fwd["top_signals"] else None
        ans = (
            f"Forward 6-month default probability is {fwd['pd_6m_pct']}% ({fwd['band']}), "
            f"income trend {fwd['trend'].lower()} ({fwd['trend_pct_per_month']}%/mo)."
            + (f" Largest driver: {sig['label_en']} (contribution {sig['contribution']})." if sig else "")
        )
        return {"answer_en": ans, "grounding": ["forward"], "source": "template"}

    if _match(q, ("fair", "bias", "discrimin", "protected", "عدال", "تحيز", "تمييز")):
        ans = (
            f"Fairness: {context['fairness']['protected_attributes_used']} protected attributes are used "
            f"in the score, and AI-payload PII exposure is {context['fairness']['ai_pii_exposure']}. "
            "The model is a fixed, published linear model, so every attribution is exact."
        )
        return {"answer_en": ans, "grounding": ["fairness"], "source": "template"}

    if _match(q, ("condition", "covenant", "escrow", "mitigat", "شرط", "ضمان", "تخفيف")):
        conds = _conditions(context)
        if not conds:
            ans = "No special conditions required — standard approval terms apply."
        else:
            ans = "Suggested conditions: " + " ".join(f"({i+1}) {c['en']}" for i, c in enumerate(conds))
        return {"answer_en": ans, "grounding": ["conditions"], "source": "template"}

    if _match(q, ("declin", "reject", "why not", "adverse", "reason", "رفض", "سبب", "لماذا")):
        if context["adverse_reasons"]:
            reasons = "; ".join(r["reason_en"] for r in context["adverse_reasons"])
            ans = f"Principal adverse-action reasons: {reasons}"
        else:
            ans = "No adverse action on this file — the application clears the financing threshold."
        return {"answer_en": ans, "grounding": ["adverse_reasons"], "source": "template"}

    if _match(q, ("strong", "best", "strength", "driver", "أقوى", "قوة", "أفضل")):
        top = context["principal_factors"][0]
        ans = f"Strongest driver is {top['label_en']} at {top['score']}/100 ({top['contribution_pct']}% of the composite)."
        return {"answer_en": ans, "grounding": ["principal_factors"], "source": "template"}

    if _match(q, ("trend", "volatil", "stability", "concentr", "divers", "client",
                  "اتجاه", "تقلب", "استقرار", "تنوع", "تركز", "عملاء")):
        f = context["factors"]
        ans = (
            f"Income stability {f['income_stability']}/100, client diversity {f['client_diversity']}/100. "
            f"Six-month income trend is {fwd['trend'].lower()} at {fwd['trend_pct_per_month']}%/mo."
        )
        grounding = ["factors", "forward"]
        vol = context.get("volatility")
        if vol and vol.get("sigma_sar") is not None:
            ans += (
                f" Underwriting is deliberately conservative: average income SAR "
                f"{vol['mean_monthly_income_sar']:,}, but the μ−1.5σ underwriting income is "
                f"SAR {vol['underwriting_income_sar']:,} — a SAR {vol['conservatism_haircut_sar']:,} "
                f"haircut driven by volatility (σ = SAR {vol['sigma_sar']:,})."
            )
            grounding.append("volatility")
        return {"answer_en": ans, "grounding": grounding, "source": "template"}

    # Fallback — a grounded summary
    ans = (
        f"{context['tier']} tier (composite {context['composite']}); decision {context['decision']}. "
        f"Forward 6-month default probability {fwd['pd_6m_pct']}% ({fwd['band']}). "
        "Ask about affordability/DBR, forward risk, fairness, conditions, or why the decision was made."
    )
    return {"answer_en": ans, "grounding": ["summary"], "source": "template"}


# ---------------------------------------------------------------------------
# Optional live-Claude paths (zero-PII aggregate only; fail-closed to template)
# ---------------------------------------------------------------------------

def _build_live_prompt(context: dict, question: str | None) -> str:
    import json  # noqa: PLC0415
    parts = ["ANONYMIZED ASSESSMENT AGGREGATE (no PII, no raw transactions):",
             json.dumps(context, ensure_ascii=False)]
    if question:
        parts.append(f"\nOfficer question: {question}")
    else:
        parts.append("\nDraft a one-sentence decisive underwriter recommendation headline.")
    return "\n".join(parts)


def _live_call(context: dict, question: str | None) -> str | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    assert_context_clean(context)  # never send an unclean aggregate
    try:
        import anthropic  # noqa: PLC0415

        client = anthropic.Anthropic(api_key=api_key, timeout=LIVE_TIMEOUT_SECONDS)
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=350,
            system=AGENT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_live_prompt(context, question)}],
        )
        return message.content[0].text.strip()
    except Exception:
        return None


def _live_draft(context: dict) -> str | None:
    return _live_call(context, None)


def _live_answer(question: str, context: dict) -> str | None:
    return _live_call(context, question)
