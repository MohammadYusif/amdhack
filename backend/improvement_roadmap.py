"""
Score improvement roadmap generator.
Returns specific, actionable steps for freelancers in Yellow or Building tier.
Each step includes projected score impact and timeline.
"""
from models import MihanScore


def generate_roadmap(profile_id: str, score: MihanScore, import_evidence: dict | None = None) -> dict:
    """
    Generate improvement actions based on which factors are weakest.
    Returns list of actions sorted by impact (highest first).

    import_evidence: the per-factor evidence map from an imported real
    statement. When present, actions are grounded in what the statement
    actually showed (e.g. cash deposits that could not count as income)
    and the contract action becomes "declare clients" — an import carries
    no declarations yet, so unverified contracts are not the gap.
    """
    actions = []
    f = score.factors
    is_import = import_evidence is not None

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
        if is_import:
            actions.append({
                "action_ar": "صرّح بعملائك في طلب مِهَن ليتم توثيقهم عبر منصة واثق",
                "action_en": "Declare your clients in the Mihan application for Wathq verification",
                "factor": "contract_verification",
                "projected_gain": 8,
                "timeline_days": 7,
                "difficulty": "low",
                "detail_en": "An imported statement carries no client declarations — declaring them "
                             "lets Wathq verify their commercial registrations, unlocking this factor.",
            })
        else:
            actions.append({
                "action_ar": "وقّع عقوداً رسمية مع عملائك عبر منصة Signit",
                "action_en": "Sign formal contracts with clients via Signit",
                "factor": "contract_verification",
                "projected_gain": 10,
                "timeline_days": 14,
                "difficulty": "low",
                "detail_en": "Signit-verified contracts with Nafath authentication are the strongest client verification signal.",
            })

    # Import-specific: income the engine SAW but could not count
    if is_import:
        excluded = (import_evidence.get("client_diversity") or {}).get("excluded_credits", {})
        cash = excluded.get("CASH_DEPOSIT", 0)
        if cash >= 1000:
            actions.append({
                "action_ar": "وجّه دخلك عبر التحويلات البنكية بدلاً من الإيداع النقدي",
                "action_en": "Route your income through bank transfers instead of cash deposits",
                "factor": "income_stability",
                "projected_gain": 6,
                "timeline_days": 30,
                "difficulty": "low",
                "detail_en": f"SAR {cash:,.0f} in cash deposits could not be counted as income — "
                             "the origin of cash is unverifiable. Traceable transfers count in full.",
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
