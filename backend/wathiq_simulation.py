"""
Wathiq API simulator.
In production: calls https://developer.wathq.sa/en with real CR numbers.
Architecture: freelancer DECLARES clients with CR numbers during onboarding.
Wathiq VERIFIES those specific declared entities.
ML maps incoming narration strings against the pre-verified set.
NOT auto-detection from raw narration strings.
"""
from datetime import date

WATHIQ_DATABASE = {
    "1010456789": {
        "trade_name_ar": "شركة تكامل القابضة",
        "trade_name_en": "Takamol Holding",
        "status": "ACTIVE",
        "activity": "Information Technology Services",
        "registration_date": "2015-03-12",
        "risk_flag": None,
    },
    "1010234567": {
        "trade_name_ar": "شركة حلول STC",
        "trade_name_en": "STC Solutions",
        "status": "ACTIVE",
        "activity": "Telecommunications",
        "registration_date": "2012-07-22",
        "risk_flag": None,
    },
    "1010891234": {
        "trade_name_ar": "مركز الرياض الرقمي",
        "trade_name_en": "Riyadh Digital Hub",
        "status": "ACTIVE",
        "activity": "Digital Services",
        "registration_date": "2019-11-05",
        "risk_flag": None,
    },
    "1010567891": {
        "trade_name_ar": "أكاديمية نون",
        "trade_name_en": "Noon Academy",
        "status": "ACTIVE",
        "activity": "Education Technology",
        "registration_date": "2017-08-14",
        "risk_flag": None,
    },
    "1010345678": {
        "trade_name_ar": "شركة تماتم للألعاب",
        "trade_name_en": "Tamatem Games",
        "status": "ACTIVE",
        "activity": "Software Development",
        "registration_date": "2013-02-28",
        "risk_flag": None,
    },
    "1010123456": {
        "trade_name_ar": "مؤسسة إيليت للفعاليات",
        "trade_name_en": "Elite Events Est",
        "status": "ACTIVE",
        "activity": "Events Management",
        "registration_date": "2024-02-15",   # Recent registration — flag for shell company check
        "risk_flag": "REGISTERED_LESS_THAN_12_MONTHS",
    },
}


def verify_cr(cr_number: str) -> dict:
    """
    Simulate Wathiq API call for a specific declared CR number.
    Returns company status and any risk flags.
    """
    company = WATHIQ_DATABASE.get(cr_number)
    if not company:
        return {
            "cr": cr_number,
            "status": "NOT_FOUND",
            "verified": False,
            "risk_flag": "CR_NOT_REGISTERED",
            "message_ar": "رقم السجل التجاري غير موجود في قاعدة بيانات وزارة التجارة",
            "message_en": "CR number not found in Ministry of Commerce database",
        }

    reg_date = date.fromisoformat(company["registration_date"])
    months_active = (date.today() - reg_date).days // 30

    return {
        "cr": cr_number,
        "trade_name_ar": company["trade_name_ar"],
        "trade_name_en": company["trade_name_en"],
        "status": company["status"],
        "activity": company["activity"],
        "months_active": months_active,
        "verified": company["status"] == "ACTIVE",
        "risk_flag": company["risk_flag"],
        "message_ar": "تم التحقق من السجل التجاري بنجاح" if not company["risk_flag"] else "تحذير: يستدعي المراجعة",
        "message_en": "CR verified successfully" if not company["risk_flag"] else "Warning: requires review",
    }


def verify_profile_clients(profile_id: str) -> list[dict]:
    """Verify all declared clients for a profile."""
    from lean_simulation import get_declared_clients
    clients = get_declared_clients(profile_id)
    return [
        {**verify_cr(c["cr"]), "declared_name": c["name"]}
        for c in clients
    ]
