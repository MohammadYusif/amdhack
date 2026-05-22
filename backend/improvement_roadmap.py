"""
Score improvement roadmap generator.
Returns specific, actionable steps for freelancers in Yellow or Building tier.
Each step includes projected score impact and timeline.
"""
from models import MihanScore


def generate_roadmap(profile_id: str, score: MihanScore) -> dict:
    """
    Generate improvement actions based on which factors are weakest.
    Returns list of actions sorted by impact (highest first).
    """
    actions = []
    f = score.factors

    # Client diversity improvements
    if f.client_diversity < 70:
        if f.client_diversity < 40:
            actions.append({
                "action_ar": "أضف عميلاً ثانياً بشكل منتظم",
                "action_en": "Add a second regular client",
                "factor": "client_diversity",
                "projected_gain": 15,
                "timeline_days": 90,
                "difficulty": "medium",
                "detail_en": "A second client reduces single-client dependency from high to moderate risk.",
            })
        else:
            actions.append({
                "action_ar": "أضف عميلاً ثالثاً لتنويع مصادر الدخل",
                "action_en": "Add a third client to diversify income sources",
                "factor": "client_diversity",
                "projected_gain": 8,
                "timeline_days": 90,
                "difficulty": "medium",
                "detail_en": "Three or more clients reduces concentration risk significantly.",
            })

    # Savings behavior improvements
    if f.savings_behavior < 60:
        target_pct = "10%" if f.savings_behavior < 40 else "8%"
        actions.append({
            "action_ar": f"ارفع معدل الادخار الشهري إلى {target_pct} من الدخل",
            "action_en": f"Increase monthly savings rate to {target_pct} of income",
            "factor": "savings_behavior",
            "projected_gain": 10 if f.savings_behavior < 40 else 6,
            "timeline_days": 60,
            "difficulty": "low",
            "detail_en": "Consistent savings demonstrate financial buffer against income gaps.",
        })

    # Income stability improvements
    if f.income_stability < 65:
        actions.append({
            "action_ar": "تحسين انتظام استلام المدفوعات من العملاء",
            "action_en": "Improve payment regularity with clients",
            "factor": "income_stability",
            "projected_gain": 12,
            "timeline_days": 120,
            "difficulty": "medium",
            "detail_en": "Request milestone-based payments instead of project-end lump sums to smooth monthly income.",
        })

    # Contract verification improvements
    if f.contract_verification < 60:
        actions.append({
            "action_ar": "وقّع عقوداً رسمية مع عملائك عبر منصة Signit",
            "action_en": "Sign formal contracts with clients via Signit",
            "factor": "contract_verification",
            "projected_gain": 10,
            "timeline_days": 14,
            "difficulty": "low",
            "detail_en": "Signit-verified contracts with Nafath authentication are the strongest client verification signal.",
        })

    # Expense discipline improvements
    if f.expense_discipline < 65:
        actions.append({
            "action_ar": "راجع المصروفات الشهرية وخفّض النسبة إلى أقل من 60% من الدخل",
            "action_en": "Review monthly expenses and reduce to below 60% of income",
            "factor": "expense_discipline",
            "projected_gain": 8,
            "timeline_days": 60,
            "difficulty": "low",
            "detail_en": "Expense discipline is the highest-weighted factor in Mihan Score.",
        })

    # Sort by projected gain descending
    actions.sort(key=lambda x: x["projected_gain"], reverse=True)

    total_gain = sum(a["projected_gain"] for a in actions)
    projected_score = min(100, score.composite + total_gain)

    from scoring import TIER_THRESHOLDS
    projected_tier = (
        "GREEN"  if projected_score >= TIER_THRESHOLDS["GREEN"]
        else "YELLOW" if projected_score >= TIER_THRESHOLDS["YELLOW"]
        else "BUILDING"
    )

    return {
        "current_score": score.composite,
        "current_tier": score.tier,
        "projected_score": round(projected_score, 1),
        "projected_tier": projected_tier,
        "actions": actions,
        "summary_ar": f"بتطبيق هذه الخطوات، يمكن رفع نتيجتك من {score.composite} إلى {round(projected_score, 1)} خلال 3-4 أشهر.",
        "summary_en": f"By completing these steps, your score could increase from {score.composite} to {round(projected_score, 1)} within 3-4 months.",
    }
