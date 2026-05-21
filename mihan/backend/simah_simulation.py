"""
SIMAH credit bureau simulator.
In production: Alinma queries SIMAH through their existing bureau membership.
All Mihan target profiles are expected to have thin/empty SIMAH files
because freelancers have not previously accessed formal credit.
A thin SIMAH file is NOT a negative signal — it is expected for this population.
"""
from datetime import date

SIMAH_DATABASE = {
    "mohammad": {
        "has_file": True,
        "total_facilities": 0,
        "active_facilities": 0,
        "delinquent_facilities": 0,
        "credit_score": None,          # No SIMAH score — insufficient data
        "file_type": "THIN",
        "months_on_file": 6,           # Recently opened bank account
        "note_ar": "لا يوجد تاريخ ائتماني. ملف شحيح — متوقع للعمالة الحرة.",
        "note_en": "No credit history. Thin file — expected for freelance population.",
    },
    "noura": {
        "has_file": True,
        "total_facilities": 1,
        "active_facilities": 1,
        "delinquent_facilities": 0,
        "credit_score": None,
        "file_type": "THIN",
        "months_on_file": 12,
        "note_ar": "تمويل BNPL واحد نشط. سجل شحيح.",
        "note_en": "One active BNPL facility. Thin file.",
    },
    "fahad": {
        "has_file": False,             # Completely empty — no file at all
        "total_facilities": 0,
        "active_facilities": 0,
        "delinquent_facilities": 0,
        "credit_score": None,
        "file_type": "EMPTY",
        "months_on_file": 0,
        "note_ar": "لا يوجد ملف ائتماني. هذا متوقع — يُطبَّق استثناء نموذج التقييم البديل.",
        "note_en": "No credit file. Expected — alternative scoring exception sandbox applies.",
    },
}


def get_simah_report(profile_id: str) -> dict:
    """
    Returns SIMAH credit report for a profile.
    Thin/empty SIMAH + Mihan Score > 75 → Underwriting Policy Exception Sandbox applies.
    Auto-rejection gate is bypassed and application routes to human credit officer review.
    """
    report = SIMAH_DATABASE.get(profile_id, {
        "has_file": False,
        "total_facilities": 0,
        "active_facilities": 0,
        "delinquent_facilities": 0,
        "credit_score": None,
        "file_type": "EMPTY",
        "months_on_file": 0,
        "note_ar": "لا يوجد ملف ائتماني",
        "note_en": "No credit file found",
    })

    is_thin = report["file_type"] in ("THIN", "EMPTY")
    exception_sandbox_applicable = is_thin

    return {
        **report,
        "profile_id": profile_id,
        "query_date": date.today().isoformat(),
        "exception_sandbox_applicable": exception_sandbox_applicable,
        "exception_sandbox_note": (
            "Thin/empty SIMAH file. If Mihan Score ≥ 75, bypass auto-rejection "
            "and route to credit officer with full Mihan decision package."
            if exception_sandbox_applicable else None
        ),
    }
