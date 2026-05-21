"""
One-shot script to generate Arabic Claude explanations.
Run once when ANTHROPIC_API_KEY is available.
Writes Arabic text to explanations.json without changing English fallbacks.

Usage:
    $env:ANTHROPIC_API_KEY = "sk-ant-..."
    python generate_cache.py
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from profiles import PROFILES, PROFILE_ORDER
from scoring import calculate_score

try:
    import anthropic
except ImportError:
    print("Run: pip install anthropic")
    sys.exit(1)

EXPLANATIONS_PATH = Path(__file__).parent / "explanations.json"
MODEL = "claude-sonnet-4-6"

SYSTEM = (
    "أنت مساعد مالي متخصص في شرح قرارات التمويل للعملاء بأسلوب واضح وإيجابي. "
    "اكتب فقرة واحدة باللغة العربية الفصحى، بأسلوب مهني ومحترم، تشرح فيها نتائج التقييم "
    "الائتماني للعميل. لا تذكر اسم العميل. لا تذكر أرقام النتائج مباشرة. "
    "الطول المثالي: 3-4 جمل."
)


def build_prompt(profile_id: str) -> str:
    profile = PROFILES[profile_id]
    score = calculate_score(profile.factor_inputs, profile.worst_month_income)
    f = score.factors
    return (
        f"انضباط المصروفات: {f.expense_discipline}/100\n"
        f"استقرار الدخل: {f.income_stability}/100\n"
        f"تنوع العملاء: {f.client_diversity}/100\n"
        f"سلوك الادخار: {f.savings_behavior}/100\n"
        f"النتيجة الإجمالية: {score.composite}/100\n"
        f"التصنيف: {score.tier}\n"
    )


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Set ANTHROPIC_API_KEY environment variable first.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)
    existing = json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8")) if EXPLANATIONS_PATH.exists() else {}

    for profile_id in PROFILE_ORDER:
        print(f"Generating explanation for {profile_id}...")
        message = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=SYSTEM,
            messages=[{"role": "user", "content": build_prompt(profile_id)}],
        )
        arabic_text = message.content[0].text.strip()
        if profile_id not in existing:
            existing[profile_id] = {}
        existing[profile_id]["ar"] = arabic_text
        print(f"  Done: {arabic_text[:60]}...")

    EXPLANATIONS_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved to {EXPLANATIONS_PATH}")


if __name__ == "__main__":
    main()
