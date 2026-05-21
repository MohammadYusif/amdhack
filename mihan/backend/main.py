import json
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io

sys.path.insert(0, str(Path(__file__).parent))

from models import HumanReviewRequest
from profiles import PROFILES, PROFILE_ORDER
from scoring import calculate_score
from database import init_db, append_audit_log, get_audit_log
from lean_simulation import generate_transactions, get_declared_clients
from wathiq_simulation import verify_profile_clients, verify_cr
from simah_simulation import get_simah_report
from improvement_roadmap import generate_roadmap

app = FastAPI(title="Mihan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EXPLANATIONS_PATH = Path(__file__).parent / "explanations.json"
_explanations: dict = {}


@app.on_event("startup")
def startup():
    init_db()
    global _explanations
    if EXPLANATIONS_PATH.exists():
        _explanations = json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8"))


@app.get("/profiles")
def list_profiles():
    return [
        {
            "id": PROFILES[pid].id,
            "name_ar": PROFILES[pid].name_ar,
            "name_en": PROFILES[pid].name_en,
            "profession_ar": PROFILES[pid].profession_ar,
            "profession_en": PROFILES[pid].profession_en,
            "avatar_initials": PROFILES[pid].avatar_initials,
        }
        for pid in PROFILE_ORDER
    ]


@app.get("/profiles/{profile_id}/score")
def get_score(profile_id: str):
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    score = calculate_score(profile.factor_inputs, profile.worst_month_income)

    append_audit_log(
        profile_id=profile.id,
        profile_name=profile.name_en,
        composite_score=score.composite,
        tier=score.tier,
        event="SCORE_CALCULATED",
        details=(
            f"expense={score.factors.expense_discipline} income={score.factors.income_stability} "
            f"diversity={score.factors.client_diversity} savings={score.factors.savings_behavior} "
            f"contract={score.factors.contract_verification}"
        ),
        endpoint="/profiles/{profile_id}/score",
    )

    return {
        "profile": {
            "id": profile.id,
            "name_ar": profile.name_ar,
            "name_en": profile.name_en,
            "profession_ar": profile.profession_ar,
            "profession_en": profile.profession_en,
            "months_of_history": profile.months_of_history,
            "client_count": profile.client_count,
            "largest_client_pct": profile.largest_client_pct,
            "monthly_savings_pct": profile.monthly_savings_pct,
        },
        "score": score.model_dump(),
    }


@app.get("/profiles/{profile_id}/explanation")
def get_explanation(profile_id: str, lang: str = "ar"):
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    entry = _explanations.get(profile_id, {})
    text = entry.get(lang) or entry.get("en", "Explanation not available.")
    return {"profile_id": profile_id, "lang": lang, "text": text}


@app.post("/profiles/{profile_id}/human-review")
def request_human_review(profile_id: str, body: HumanReviewRequest):
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    score = calculate_score(profile.factor_inputs, profile.worst_month_income)

    append_audit_log(
        profile_id=profile.id,
        profile_name=profile.name_en,
        composite_score=score.composite,
        tier=score.tier,
        event="HUMAN_REVIEW_REQUESTED",
        details=body.notes or "No notes provided",
        endpoint="/profiles/{profile_id}/human-review",
    )
    return {"status": "ok", "message": "Human review request logged"}


@app.get("/audit-log")
def audit_log():
    return get_audit_log()


@app.get("/profiles/{profile_id}/proof-of-income")
def proof_of_income(profile_id: str):
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    from pdf_gen import generate_proof_of_income
    pdf_bytes = generate_proof_of_income(profile)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cash-flow-history-{profile_id}.pdf"'
        },
    )


@app.get("/profiles/{profile_id}/lean-transactions")
def lean_transactions(profile_id: str, months: int = 18):
    """Simulate Lean AIS cross-bank transaction history pull."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    transactions = generate_transactions(profile_id, months)
    clients = get_declared_clients(profile_id)
    return {
        "profile_id": profile_id,
        "months_requested": months,
        "transaction_count": len(transactions),
        "declared_clients": clients,
        "transactions": transactions,
        "data_source": "Lean Technologies AIS (simulated for demo)",
        "note": "In production: real Lean AIS API call with customer consent",
    }


@app.get("/profiles/{profile_id}/wathiq")
def wathiq_verify(profile_id: str):
    """Verify declared client companies via Wathiq API."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    results = verify_profile_clients(profile_id)
    all_verified = all(r["verified"] for r in results)
    has_flags = any(r.get("risk_flag") for r in results)
    return {
        "profile_id": profile_id,
        "clients_checked": len(results),
        "all_verified": all_verified,
        "has_risk_flags": has_flags,
        "results": results,
        "data_source": "Wathiq — Ministry of Commerce (SAMA Circular 472047799)",
    }


@app.get("/profiles/{profile_id}/simah")
def simah_report(profile_id: str):
    """Retrieve SIMAH credit bureau report."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    report = get_simah_report(profile_id)
    score = calculate_score(
        PROFILES[profile_id].factor_inputs,
        PROFILES[profile_id].worst_month_income,
    )
    exception_triggered = (
        report["exception_sandbox_applicable"] and score.composite >= 75
    )
    append_audit_log(
        profile_id=profile_id,
        profile_name=PROFILES[profile_id].name_en,
        composite_score=score.composite,
        tier=score.tier,
        event="SIMAH_QUERIED",
        details=f"file_type={report['file_type']} exception_sandbox={exception_triggered}",
        endpoint="/profiles/{profile_id}/simah",
    )
    return {
        **report,
        "exception_sandbox_triggered": exception_triggered,
        "exception_note": (
            "Mihan Score ≥ 75 with thin SIMAH — auto-rejection bypassed. "
            "Routing to credit officer with full Mihan decision package."
            if exception_triggered else None
        ),
    }


@app.get("/profiles/{profile_id}/roadmap")
def score_roadmap(profile_id: str):
    """Return score improvement roadmap for Yellow and Building tier profiles."""
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    score = calculate_score(profile.factor_inputs, profile.worst_month_income)
    roadmap = generate_roadmap(profile_id, score)
    return roadmap


@app.post("/rejection-check")
def rejection_check(data: dict):
    """
    Simulates current Alinma rejection flow (no Mihan).
    Returns the wall that freelancers currently hit.
    Used for the demo opening — the 'before Mihan' moment.
    """
    return {
        "approved": False,
        "reason_code": "NO_SALARY_TRANSFER",
        "reason_ar": "يجب تحويل الراتب من جهة العمل للحصول على التمويل",
        "reason_en": "Salary must be transferred from employer to qualify for financing",
        "suggestion_ar": "هل أنت عامل حر؟ جرّب تمويل المستقلين المدعوم بمِهَن",
        "suggestion_en": "Are you a freelancer? Try our Mihan-powered freelancer financing",
        "mihan_available": True,
    }


@app.get("/profiles/{profile_id}/full-assessment")
def full_assessment(profile_id: str):
    """
    Complete end-to-end assessment pipeline:
    1. SIMAH report
    2. Lean AIS transactions
    3. Wathiq client verification
    4. Mihan score calculation
    5. Loan recommendation
    Used to drive the 60-second scoring animation in the frontend.
    """
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    simah = get_simah_report(profile_id)
    transactions = generate_transactions(profile_id)
    wathiq = verify_profile_clients(profile_id)
    score = calculate_score(profile.factor_inputs, profile.worst_month_income)

    exception_triggered = (
        simah["exception_sandbox_applicable"] and score.composite >= 75
    )

    append_audit_log(
        profile_id=profile.id,
        profile_name=profile.name_en,
        composite_score=score.composite,
        tier=score.tier,
        event="FULL_ASSESSMENT_COMPLETED",
        details=(
            f"simah={simah['file_type']} wathiq_verified={all(w['verified'] for w in wathiq)} "
            f"exception_sandbox={exception_triggered}"
        ),
        endpoint="/profiles/{profile_id}/full-assessment",
    )

    return {
        "profile": {
            "id": profile.id,
            "name_ar": profile.name_ar,
            "name_en": profile.name_en,
            "profession_ar": profile.profession_ar,
            "profession_en": profile.profession_en,
        },
        "pipeline": {
            "step1_kyc":      {"status": "COMPLETE", "method": "Nafath biometric + Virtual Core Banking Profile"},
            "step2_lean_ais": {"status": "COMPLETE", "transactions_pulled": len(transactions), "months": 18},
            "step3_simah":    {"status": "COMPLETE", "file_type": simah["file_type"]},
            "step4_wathiq":   {"status": "COMPLETE", "clients_verified": sum(1 for w in wathiq if w["verified"]), "total_clients": len(wathiq)},
            "step5_scoring":  {"status": "COMPLETE", "composite": score.composite, "tier": score.tier},
        },
        "score": score.model_dump(),
        "simah": simah,
        "wathiq_results": wathiq,
        "exception_sandbox_triggered": exception_triggered,
        "loan_recommendation": score.loan.model_dump() if score.loan else None,
        "next_step": (
            "APPROVE_FOR_REVIEW" if score.tier in ("GREEN", "YELLOW")
            else "IMPROVEMENT_ROADMAP"
        ),
    }
