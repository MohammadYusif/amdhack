from models import Profile, FactorScores

PROFILES: dict[str, Profile] = {
    "mohammad": Profile(
        id="mohammad",
        name_ar="محمد الغامدي",
        name_en="Mohammad Al-Ghamdi",
        profession_ar="مطور تطبيقات",
        profession_en="App Developer",
        avatar_initials="م غ",
        factor_inputs=FactorScores(
            expense_discipline=88,
            income_stability=80,
            client_diversity=72,
            savings_behavior=65,
        ),
        worst_month_income=9500,
        months_of_history=18,
        client_count=3,
        largest_client_pct=42,
        monthly_savings_pct=8,
    ),
    "noura": Profile(
        id="noura",
        name_ar="نورة العمري",
        name_en="Noura Al-Omari",
        profession_ar="مصممة جرافيك",
        profession_en="Graphic Designer",
        avatar_initials="ن ع",
        factor_inputs=FactorScores(
            expense_discipline=74,
            income_stability=60,
            client_diversity=55,
            savings_behavior=42,
        ),
        worst_month_income=6200,
        months_of_history=12,
        client_count=2,
        largest_client_pct=65,
        monthly_savings_pct=3,
    ),
    "fahad": Profile(
        id="fahad",
        name_ar="فهد القحطاني",
        name_en="Fahad Al-Qahtani",
        profession_ar="مصور فوتوغرافي",
        profession_en="Photographer",
        avatar_initials="ف ق",
        factor_inputs=FactorScores(
            expense_discipline=53,
            income_stability=45,
            client_diversity=22,
            savings_behavior=28,
        ),
        worst_month_income=3800,
        months_of_history=8,
        client_count=1,
        largest_client_pct=71,
        monthly_savings_pct=2,
    ),
}

PROFILE_ORDER = ["mohammad", "noura", "fahad"]
