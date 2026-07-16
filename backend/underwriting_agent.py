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
    "defer the final decision to the human officer. Respond in the same language "
    "as the officer's question (Arabic questions get Arabic answers)."
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

# Arabic text folds before keyword matching: harakat + shadda diacritics and
# tatweel are cosmetic (the officer chip says "التحيّز" — with shadda — while a
# keyword stores "تحيز"), and alef variants (أ إ آ) are interchangeable in
# real-world typing. Without this fold, substring matching silently fails on
# perfectly normal Arabic and the question drops to the generic summary.
_AR_DIACRITICS = re.compile(r"[ً-ْـ]")
_AR_ALEF = re.compile(r"[أإآ]")


def _normalize(text: str) -> str:
    text = _AR_DIACRITICS.sub("", text)
    text = _AR_ALEF.sub("ا", text)
    return text.lower()


def _match(question: str, keywords: tuple[str, ...]) -> bool:
    q = _normalize(question)
    return any(_normalize(k) in q for k in keywords)


# --- Intent handlers: each returns (answer_en, answer_ar, grounding) --------
# Bilingual by construction: the officer dashboard is Arabic-first, so an
# Arabic question must get an Arabic answer — the English field is for the
# EN toggle and the audit trail. Technical tokens (band, DBR, μ/σ) stay
# inline in English per the app-wide design rule.

def _ans_dbr(ctx: dict) -> tuple[str, str, list[str]]:
    dbr = ctx["dbr"]
    en = (
        f"Affordability is set by SAMA Art. 14(b): 45% of the {dbr['income_basis_sar']:,} SAR "
        f"underwriting income = {dbr['max_installment_sar']:,} SAR max installment. "
        f"Offered {dbr['offered_installment_sar']:,} SAR, headroom {dbr['headroom_sar']:,} SAR"
        + (" — offer is compressed to the ceiling." if dbr["compressed"] else ".")
    )
    ar = (
        f"القدرة على السداد وفق ساما م.14(ب): 45% من دخل الاكتتاب البالغ {dbr['income_basis_sar']:,} ريال "
        f"= حد أقصى للقسط {dbr['max_installment_sar']:,} ريال. "
        f"القسط المعروض {dbr['offered_installment_sar']:,} ريال، والهامش المتاح {dbr['headroom_sar']:,} ريال"
        + (" — العرض مخفّض إلى السقف." if dbr["compressed"] else ".")
    )
    return en, ar, ["dbr"]


def _ans_forward(ctx: dict) -> tuple[str, str, list[str]]:
    fwd = ctx["forward"]
    sig = fwd["top_signals"][0] if fwd["top_signals"] else None
    en = (
        f"Forward 6-month default probability is {fwd['pd_6m_pct']}% ({fwd['band']}), "
        f"income trend {fwd['trend'].lower()} ({fwd['trend_pct_per_month']}%/mo)."
        + (f" Largest driver: {sig['label_en']} (contribution {sig['contribution']})." if sig else "")
    )
    ar = (
        f"احتمالية التعثّر خلال 6 أشهر هي {fwd['pd_6m_pct']}% ({fwd['band']})، "
        f"واتجاه الدخل {fwd['trend']} بمعدل {fwd['trend_pct_per_month']}% شهرياً."
        + (f" أكبر مساهم في المخاطر: {sig['label_ar']} (المساهمة {sig['contribution']})." if sig else "")
    )
    return en, ar, ["forward"]


def _ans_fairness(ctx: dict) -> tuple[str, str, list[str]]:
    n = ctx["fairness"]["protected_attributes_used"]
    exposure = ctx["fairness"]["ai_pii_exposure"]
    en = (
        f"Fairness: {n} protected attributes are used "
        f"in the score, and AI-payload PII exposure is {exposure}. "
        "The model is a fixed, published linear model, so every attribution is exact."
    )
    ar = (
        f"العدالة: عدد الخصائص المحمية المستخدمة في النتيجة {n}، "
        f"وتعرّض حمولة الذكاء الاصطناعي للبيانات الشخصية: {exposure}. "
        "النموذج خطي ثابت ومنشور المعاملات، لذا كل إسناد للعوامل دقيق وليس تقريبياً."
    )
    return en, ar, ["fairness"]


def _ans_conditions(ctx: dict) -> tuple[str, str, list[str]]:
    conds = _conditions(ctx)
    if not conds:
        en = "No special conditions required — standard approval terms apply."
        ar = "لا حاجة لشروط خاصة — تسري أحكام الموافقة القياسية."
    else:
        en = "Suggested conditions: " + " ".join(f"({i+1}) {c['en']}" for i, c in enumerate(conds))
        ar = "الشروط المقترحة: " + " ".join(f"({i+1}) {c['ar']}" for i, c in enumerate(conds))
    return en, ar, ["conditions"]


def _ans_adverse(ctx: dict) -> tuple[str, str, list[str]]:
    if ctx["adverse_reasons"]:
        en = "Principal adverse-action reasons: " + "; ".join(r["reason_en"] for r in ctx["adverse_reasons"])
        ar = "الأسباب الرئيسية للإجراء السلبي: " + "؛ ".join(r["reason_ar"] for r in ctx["adverse_reasons"])
    else:
        en = "No adverse action on this file — the application clears the financing threshold."
        ar = "لا يوجد إجراء سلبي على هذا الملف — الطلب يتجاوز عتبة التمويل."
    return en, ar, ["adverse_reasons"]


def _ans_strength(ctx: dict) -> tuple[str, str, list[str]]:
    top = ctx["principal_factors"][0]
    en = f"Strongest driver is {top['label_en']} at {top['score']}/100 ({top['contribution_pct']}% of the composite)."
    ar = f"أقوى عامل هو {top['label_ar']} بدرجة {top['score']}/100 ({top['contribution_pct']}% من النتيجة الإجمالية)."
    return en, ar, ["principal_factors"]


def _ans_stability(ctx: dict) -> tuple[str, str, list[str]]:
    f = ctx["factors"]
    fwd = ctx["forward"]
    en = (
        f"Income stability {f['income_stability']}/100, client diversity {f['client_diversity']}/100. "
        f"Six-month income trend is {fwd['trend'].lower()} at {fwd['trend_pct_per_month']}%/mo."
    )
    ar = (
        f"استقرار الدخل {f['income_stability']}/100، وتنوع العملاء {f['client_diversity']}/100. "
        f"اتجاه الدخل خلال 6 أشهر {fwd['trend']} بمعدل {fwd['trend_pct_per_month']}% شهرياً."
    )
    grounding = ["factors", "forward"]
    vol = ctx.get("volatility")
    if vol and vol.get("sigma_sar") is not None:
        en += (
            f" Underwriting is deliberately conservative: average income SAR "
            f"{vol['mean_monthly_income_sar']:,}, but the μ−1.5σ underwriting income is "
            f"SAR {vol['underwriting_income_sar']:,} — a SAR {vol['conservatism_haircut_sar']:,} "
            f"haircut driven by volatility (σ = SAR {vol['sigma_sar']:,})."
        )
        ar += (
            f" الاكتتاب متحفّظ عمداً: متوسط الدخل {vol['mean_monthly_income_sar']:,} ريال، "
            f"بينما دخل الاكتتاب (μ−1.5σ) هو {vol['underwriting_income_sar']:,} ريال — "
            f"خصم قدره {vol['conservatism_haircut_sar']:,} ريال بسبب التقلب (σ = {vol['sigma_sar']:,} ريال)."
        )
        grounding.append("volatility")
    return en, ar, grounding


def _ans_what_if(ctx: dict) -> tuple[str, str, list[str]]:
    """Curveball / hypothetical. Directional and honest — names which factors a
    change would move and defers to a re-score for numbers. Never invents figures."""
    fwd = ctx["forward"]
    en = (
        "Directional read only (not a re-score): a new recurring high-value client would raise "
        "client diversity and, if sustained across months, income stability — both lift the composite "
        f"from {ctx['composite']} and widen DBR headroom via higher underwriting income. The binding "
        f"constraint today is the {ctx['tier']} composite with a {fwd['band']} 6-month outlook. "
        "Re-run the assessment with the updated statement to quantify the new score and offer."
    )
    ar = (
        "قراءة اتجاهية فقط (وليست إعادة تقييم): عميل جديد متكرر بقيمة عالية سيرفع تنوع العملاء، "
        "وإذا استمر عبر الأشهر فسيرفع استقرار الدخل أيضاً — وكلاهما يرفع النتيجة الإجمالية من "
        f"{ctx['composite']} ويوسّع هامش نسبة الدين عبر دخل اكتتاب أعلى. القيد الأساسي اليوم هو تصنيف "
        f"{ctx['tier']} مع نظرة مستقبلية {fwd['band']} لستة أشهر. "
        "أعد التقييم بالكشف المحدّث لتحديد النتيجة والعرض الجديدين."
    )
    return en, ar, ["what_if", "forward"]


# (keywords, handler) — evaluated in this order; ALL matches compose one answer.
# Arabic keywords must cover the app's own suggestion chips: singular AND
# broken-plural stems ("خطر" is not a substring of "مخاطر", nor "شرط" of
# "الشروط"), or the chips the UI offers route to the generic summary.
INTENTS = [
    (("dbr", "install", "afford", "capacity", "قسط", "نسبة الدين", "سداد", "طاقة"), _ans_dbr),
    (("risk", "default", "6 month", "forward", "future", "next", "outlook",
      "تعثر", "خطر", "مخاطر", "أخطار", "مستقبل", "احتمال", "قادم"), _ans_forward),
    (("fair", "bias", "discrimin", "protected", "عدال", "عادل", "تحيز", "تمييز"), _ans_fairness),
    (("condition", "covenant", "escrow", "mitigat", "شرط", "شروط", "تقترح", "ضمان", "تخفيف"), _ans_conditions),
    (("declin", "reject", "why not", "adverse", "رفض", "سبب", "أسباب", "لماذا"), _ans_adverse),
    (("strong", "best", "strength", "أقوى", "قوة", "أفضل"), _ans_strength),
    (("trend", "volatil", "stability", "concentr", "divers", "client",
      "اتجاه", "تقلب", "استقرار", "تنوع", "تركز", "عملاء"), _ans_stability),
    (("what if", "what-if", "suppose", "imagine", "hypothetical", "new contract",
      "high-value", "high value", "ماذا لو", "لو حصل", "عقد جديد", "افترض"), _ans_what_if),
]

MAX_COMPOSED_INTENTS = 3


def answer_question(question: str, context: dict, *, allow_live: bool = False) -> dict:
    """Answer an officer's question, grounded strictly in the aggregate context.
    ALL matching intents are composed into one answer (so a question touching
    both DBR and forward risk pulls from both), with union grounding.
    Deterministic by default; opt-in live Claude with template fallback."""
    assert_context_clean(context)
    q = (question or "").strip()

    if allow_live:
        live = _live_answer(q, context)
        if live:
            # the model is instructed to answer in the question's language, so
            # the text is already language-appropriate; answer_ar stays None
            # and the UI falls back to this field.
            return {"answer_en": live, "answer_ar": None,
                    "grounding": ["forward", "dbr", "principal_factors"],
                    "source": "claude-live"}

    matches = [handler(context) for keywords, handler in INTENTS if _match(q, keywords)]
    matches = matches[:MAX_COMPOSED_INTENTS]

    if not matches:
        fwd = context["forward"]
        en = (
            f"{context['tier']} tier (composite {context['composite']}); decision {context['decision']}. "
            f"Forward 6-month default probability {fwd['pd_6m_pct']}% ({fwd['band']}). "
            "Ask about affordability/DBR, forward risk, fairness, conditions, or why the decision was made."
        )
        ar = (
            f"تصنيف {context['tier']} (النتيجة الإجمالية {context['composite']})؛ القرار {context['decision']}. "
            f"احتمالية التعثّر خلال 6 أشهر {fwd['pd_6m_pct']}% ({fwd['band']}). "
            "اسأل عن القدرة على السداد/نسبة الدين، المخاطر المستقبلية، العدالة، الشروط، أو أسباب القرار."
        )
        return {"answer_en": en, "answer_ar": ar, "grounding": ["summary"], "source": "template"}

    answer_en = " ".join(en for en, _, _ in matches)
    answer_ar = " ".join(ar for _, ar, _ in matches)
    grounding: list[str] = []
    for _, _, gs in matches:
        for g in gs:
            if g not in grounding:
                grounding.append(g)
    return {"answer_en": answer_en, "answer_ar": answer_ar,
            "grounding": grounding, "source": "template"}


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
