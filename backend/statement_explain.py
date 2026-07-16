"""
AI explanation for IMPORTED statements — same try-real-then-fallback
architecture as every other integration in Mihan.

The personas ship pre-generated Claude explanations (explanations.json);
an imported statement can't, because its scores don't exist until the
statement arrives. So this module:

  1. builds the payload through ai_privacy.build_ai_prompt_from_score —
     the SAME zero-PII path as the personas (five scores + tier, nothing
     else; the statement's transactions never reach the model),
  2. calls Claude live if ANTHROPIC_API_KEY is set (short timeout),
  3. falls back to a deterministic bilingual template on any failure —
     the demo never blocks on network or quota.

The response always says which source produced the text, so the on-stage
"is this live?" question has an honest answer either way.
"""
from __future__ import annotations

import os

from ai_privacy import SYSTEM_PROMPT, build_ai_prompt_from_score
from models import FactorScores, MihanScore

CLAUDE_MODEL = "claude-sonnet-4-6"
LIVE_TIMEOUT_SECONDS = 12

FACTOR_NAMES = {
    "expense_discipline": {"ar": "انضباط المصروفات", "en": "expense discipline"},
    "income_stability": {"ar": "استقرار الدخل", "en": "income stability"},
    "client_diversity": {"ar": "تنوع مصادر الدخل", "en": "income-source diversity"},
    "savings_behavior": {"ar": "سلوك الادخار", "en": "savings behavior"},
    "contract_verification": {"ar": "توثيق العقود", "en": "contract verification"},
}

TIER_OPENERS = {
    "GREEN": {
        "ar": "يعكس تدفقك النقدي قدرة سداد قوية وواضحة.",
        "en": "Your cash flow reflects a strong, clear repayment capacity.",
    },
    "YELLOW": {
        "ar": "يُظهر تدفقك النقدي قدرة سداد جيدة مع جوانب قابلة للتحسين.",
        "en": "Your cash flow shows good repayment capacity with room to improve.",
    },
    "BUILDING": {
        "ar": "تقييمك الحالي في مرحلة البناء — وهذا ليس رفضاً، بل نقطة انطلاق.",
        "en": "Your assessment is in the building stage — not a rejection, but a starting point.",
    },
}


def _strongest_weakest(factors: FactorScores) -> tuple[str, str]:
    items = {k: getattr(factors, k) for k in FACTOR_NAMES}
    # contract_verification is structurally 0 on imports (nothing declared
    # yet) — never call it the applicant's "weakness"
    weakest_pool = {k: v for k, v in items.items() if k != "contract_verification"}
    strongest = max(items, key=items.get)
    weakest = min(weakest_pool, key=weakest_pool.get)
    return strongest, weakest


def _template_explanation(factors: FactorScores, score: MihanScore) -> dict:
    strongest, weakest = _strongest_weakest(factors)
    s_ar, s_en = FACTOR_NAMES[strongest]["ar"], FACTOR_NAMES[strongest]["en"]
    w_ar, w_en = FACTOR_NAMES[weakest]["ar"], FACTOR_NAMES[weakest]["en"]
    opener = TIER_OPENERS[score.tier]

    ar = (
        f"{opener['ar']} "
        f"أبرز نقاط قوتك هي {s_ar}، بينما يمثل {w_ar} أكبر فرصة للتحسين. "
    )
    en = (
        f"{opener['en']} "
        f"Your clearest strength is {s_en}, while {w_en} is your biggest improvement opportunity. "
    )
    if score.tier == "BUILDING":
        ar += "اتبع خطوات خارطة التحسين أدناه وأعد التقييم — الطريق إلى التمويل مرسوم بوضوح."
        en += "Follow the improvement roadmap below and reassess — the path to financing is clearly mapped."
    else:
        ar += "استمر على هذا النمط المالي للحفاظ على أهليتك للتمويل."
        en += "Maintain this financial pattern to keep your financing eligibility."

    return {"ar": ar, "en": en, "source": "template"}


def _live_explanation(factors: FactorScores, score: MihanScore) -> dict | None:
    """One live Claude call with the zero-PII payload. Returns None on ANY
    failure — missing key, missing SDK, network, quota — so the caller
    falls back to the template."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic  # noqa: PLC0415 — optional dependency

        # max_retries=0 is load-bearing, not a default worth inheriting: the
        # SDK retries twice by default and `timeout` is PER ATTEMPT, so on a
        # stalled connection (venue wifi) the "12s" budget silently becomes
        # ~3x12s + backoff and the button hangs ~40s. One attempt, then fall
        # back to the template — that is what makes the demo path non-blocking.
        client = anthropic.Anthropic(
            api_key=api_key, timeout=LIVE_TIMEOUT_SECONDS, max_retries=0
        )
        message = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=400,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": build_ai_prompt_from_score(factors, score.composite, score.tier),
            }],
        )
        arabic = message.content[0].text.strip()
        template = _template_explanation(factors, score)
        return {"ar": arabic, "en": template["en"], "source": "claude-live"}
    except Exception:
        return None


def explain_import(factors: FactorScores, score: MihanScore, allow_live: bool = False) -> dict:
    """Explanation + the literal AI payload (the import-side privacy proof).
    allow_live=True attempts one live Claude call first; the deterministic
    template is both the default and the fallback, so the demo never blocks."""
    explanation = (_live_explanation(factors, score) if allow_live else None) \
        or _template_explanation(factors, score)
    return {
        **explanation,
        "ai_privacy": {
            "payload_sent_to_ai": {
                "model": CLAUDE_MODEL,
                "system": SYSTEM_PROMPT,
                "user_message": build_ai_prompt_from_score(
                    factors, score.composite, score.tier
                ),
            },
            "note_en": (
                "Even for a real imported statement, the AI model receives only "
                "these five scores and the tier — none of the 900+ transactions, "
                "no counterparties, no amounts."
            ),
            "note_ar": (
                "حتى مع كشف حساب حقيقي مستورد، لا يصل إلى نموذج الذكاء الاصطناعي "
                "سوى خمس درجات رقمية والتصنيف — لا معاملات، لا أطراف، لا مبالغ."
            ),
        },
    }
