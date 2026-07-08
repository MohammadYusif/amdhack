"""
The single source of truth for what is allowed to reach the AI model.

Both the offline generation script (generate_cache.py) and the live
/ai-privacy-proof endpoint build the payload through THIS module, so the
proof shown on stage is the real payload construction path — not a
parallel sanitized copy that could drift from reality.

Design rule: the AI receives five 0-100 factor scores, the composite,
and the tier label. Nothing else. No name, no national ID, no IBAN,
no client company names, no CR numbers, no transactions.
"""
from models import Profile
from scoring import calculate_score
from factor_analysis import derive_factors

SYSTEM_PROMPT = (
    "أنت مساعد مالي متخصص في شرح قرارات التمويل للعملاء بأسلوب واضح وإيجابي. "
    "اكتب فقرة واحدة باللغة العربية الفصحى، بأسلوب مهني ومحترم، تشرح فيها نتائج التقييم "
    "الائتماني للعميل. لا تذكر اسم العميل. لا تذكر أرقام النتائج مباشرة. "
    "الطول المثالي: 3-4 جمل."
)

# What the bank holds about an applicant but deliberately never sends to
# the model. Surfaced verbatim in the on-stage privacy proof.
EXCLUDED_FIELDS = [
    "الاسم الكامل (name_ar / name_en)",
    "رقم الهوية الوطنية",
    "أرقام الحسابات و IBAN",
    "أسماء عملاء المستقل وسجلاتهم التجارية (CR)",
    "المعاملات البنكية الخام (Lean AIS)",
    "تقرير سمة SIMAH",
    "بيانات التواصل (جوال / بريد)",
]


def build_ai_prompt_from_score(factors, composite: float, tier: str) -> str:
    """The exact user-message text sent to Claude: anonymized scores only.
    Takes bare scores so BOTH the persona path and the imported-statement
    path build their payload through this single function."""
    return (
        f"انضباط المصروفات: {factors.expense_discipline}/100\n"
        f"استقرار الدخل: {factors.income_stability}/100\n"
        f"تنوع العملاء: {factors.client_diversity}/100\n"
        f"سلوك الادخار: {factors.savings_behavior}/100\n"
        f"توثيق العقود: {factors.contract_verification}/100\n"
        f"النتيجة الإجمالية: {composite}/100\n"
        f"التصنيف: {tier}\n"
    )


def build_ai_prompt(profile: Profile) -> str:
    """Persona payload — anonymized scores only."""
    factors, _ = derive_factors(profile)
    score = calculate_score(factors, profile.worst_month_income)
    return build_ai_prompt_from_score(score.factors, score.composite, score.tier)


def build_privacy_proof(profile: Profile) -> dict:
    """Everything the judge needs to verify the PII claim in one response:
    the literal payload, what was withheld, and when generation happens."""
    return {
        "profile_id": profile.id,
        "payload_sent_to_ai": {
            "model": "claude",
            "system": SYSTEM_PROMPT,
            "user_message": build_ai_prompt(profile),
        },
        "fields_the_bank_holds_but_never_sends": EXCLUDED_FIELDS,
        "generation_mode": "OFFLINE_BATCH",
        "note_ar": (
            "هذه هي الحمولة الكاملة والحرفية التي تصل إلى نموذج الذكاء الاصطناعي: "
            "خمس درجات رقمية وتصنيف — بلا اسم، بلا هوية، بلا معاملات. "
            "التوليد يتم دفعياً خارج مسار التقييم الحي، فلا تُرسل أي بيانات لحظة اتخاذ القرار."
        ),
        "note_en": (
            "This is the complete, literal payload that reaches the AI model: "
            "five numeric scores and a tier — no name, no ID, no transactions. "
            "Generation runs as an offline batch outside the live scoring path, "
            "so nothing is transmitted at decision time."
        ),
    }
