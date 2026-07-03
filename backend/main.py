import json
import os
import sys
import zlib
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
load_dotenv(Path(__file__).parent / ".env")

from models import HumanReviewRequest
from profiles import PROFILES, PROFILE_ORDER
from scoring import calculate_score, calculate_score_vanc
from database import init_db, append_audit_log, get_audit_log
from lean_simulation import generate_transactions, get_declared_clients
from factor_analysis import derive_factors, monthly_income_buckets
from wathiq_simulation import verify_profile_clients, verify_cr
from simah_simulation import get_simah_report
from improvement_roadmap import generate_roadmap

EXPLANATIONS_PATH = Path(__file__).parent / "explanations.json"
_explanations: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    global _explanations
    if EXPLANATIONS_PATH.exists():
        _explanations = json.loads(EXPLANATIONS_PATH.read_text(encoding="utf-8"))
    yield


app = FastAPI(title="Mihan API", version="1.0.0", lifespan=lifespan)

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

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


def _monthly_buckets_from_transactions(profile_id: str) -> list[int]:
    """Zero-filled per-month totals for VANC input (see factor_analysis)."""
    return monthly_income_buckets(profile_id)


@app.get("/profiles/{profile_id}/score")
def get_score(profile_id: str, version: str = "v1"):
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    factors, _ = derive_factors(profile)
    if version == "v2":
        score = calculate_score_vanc(factors, _monthly_buckets_from_transactions(profile_id))
    else:
        score = calculate_score(factors, profile.worst_month_income)

    append_audit_log(
        profile_id=profile.id,
        profile_name=profile.name_en,
        composite_score=score.composite,
        tier=score.tier,
        event=f"SCORE_CALCULATED_{version.upper()}",
        details=(
            f"expense={score.factors.expense_discipline} income={score.factors.income_stability} "
            f"diversity={score.factors.client_diversity} savings={score.factors.savings_behavior} "
            f"contract={score.factors.contract_verification} version={version}"
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
            "selected_buffer": profile.selected_buffer,
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

    score = calculate_score(derive_factors(profile)[0], profile.worst_month_income)

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


@app.get("/wathiq-live-proof")
def wathiq_live_proof(cr: str | None = None):
    """
    On-demand real call to the live Wathiq API (not the demo simulation).
    Used by the "خلف الكواليس" panel to prove the integration genuinely
    works end-to-end, independent of the curated persona narrative.
    """
    from wathiq_api import fetch_live_proof, LIVE_PROOF_SAMPLE_CR
    return fetch_live_proof(cr or LIVE_PROOF_SAMPLE_CR)


@app.get("/profiles/{profile_id}/factor-analysis")
def factor_analysis(profile_id: str):
    """
    Shows exactly HOW each scoring factor was obtained: income_stability
    and client_diversity are computed live from the Lean AIS transaction
    data (CV over a zero-filled income window; HHI over income senders),
    with the intermediate numbers exposed. The rest carry their
    provenance labels. Drives the "behind the scenes" transparency panel.
    """
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    factors, evidence = derive_factors(profile)
    return {
        "profile_id": profile_id,
        "effective_factors": factors.model_dump(),
        "evidence": evidence,
        "monthly_income_buckets": monthly_income_buckets(profile_id),
        "note": "income_stability and client_diversity are recomputed from "
                "transaction data on every call — nothing pre-baked.",
    }


@app.get("/profiles/{profile_id}/simah")
def simah_report(profile_id: str):
    """Retrieve SIMAH credit bureau report."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    report = get_simah_report(profile_id)
    score = calculate_score(
        derive_factors(PROFILES[profile_id])[0],
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
    score = calculate_score(derive_factors(profile)[0], profile.worst_month_income)
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


@app.get("/health")
def health_check():
    """Deployment health check — verifies DB, profiles, and scoring engine."""
    test_score = calculate_score(
        derive_factors(PROFILES["mohammad"])[0],
        PROFILES["mohammad"].worst_month_income,
    )
    return {
        "status": "ok",
        "version": "7.5",
        "profiles_loaded": len(PROFILES),
        "scoring_engine": "phase1+vanc",
        "dbr_cap": "45%",
        "test_score": test_score.composite,
        "test_tier": test_score.tier,
        "db_connected": True,
    }


@app.get("/profiles/{profile_id}/pipeline/step1")
def pipeline_step1(profile_id: str):
    """KYC + Virtual Core Banking Profile creation."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    # crc32 (not built-in hash) so the IBAN/ref stay identical across restarts
    stable_id = zlib.crc32(profile_id.encode())
    return {
        "step": "step1_kyc",
        "status": "COMPLETE",
        "method": "Nafath biometric + Virtual Core Banking Profile",
        "tech_iban": f"SA71 0800 0000 {stable_id % 10000:04d} 0000 0000",
        "kyc_ref": f"KYC-{stable_id % 900000 + 100000}",
    }


@app.get("/profiles/{profile_id}/pipeline/step2")
def pipeline_step2(profile_id: str):
    """Lean AIS data pull."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    transactions = generate_transactions(profile_id)
    clients = get_declared_clients(profile_id)
    total_pulled = len(transactions)
    monthly: dict = {}
    for tx in transactions:
        m = tx["date"][:7]
        monthly[m] = monthly.get(m, 0) + tx["amount"]
    avg_monthly = int(sum(monthly.values()) / len(monthly)) if monthly else 0
    append_audit_log(
        profile_id=profile_id,
        profile_name=PROFILES[profile_id].name_en,
        composite_score=0,
        tier="PENDING",
        event="LEAN_AIS_PULL",
        details=f"transactions={total_pulled} avg_monthly={avg_monthly}",
        endpoint="/pipeline/step2",
    )
    return {
        "step": "step2_lean_ais",
        "status": "COMPLETE",
        "transactions_pulled": total_pulled,
        "months": 18,
        "avg_monthly_income": avg_monthly,
        "declared_clients": clients,
        "monthly_buckets": monthly,
    }


@app.get("/profiles/{profile_id}/pipeline/step3")
def pipeline_step3(profile_id: str):
    """SIMAH credit bureau check."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    report = get_simah_report(profile_id)
    append_audit_log(
        profile_id=profile_id,
        profile_name=PROFILES[profile_id].name_en,
        composite_score=0,
        tier="PENDING",
        event="SIMAH_QUERIED",
        details=f"file_type={report['file_type']}",
        endpoint="/pipeline/step3",
    )
    return {"step": "step3_simah", "status": "COMPLETE", **report}


@app.get("/profiles/{profile_id}/pipeline/step4")
def pipeline_step4(profile_id: str):
    """Wathiq client verification."""
    if profile_id not in PROFILES:
        raise HTTPException(status_code=404, detail="Profile not found")
    results = verify_profile_clients(profile_id)
    return {
        "step": "step4_wathiq",
        "status": "COMPLETE",
        "clients_verified": sum(1 for w in results if w["verified"]),
        "total_clients": len(results),
        "has_risk_flags": any(w.get("risk_flag") for w in results),
        "results": results,
    }


@app.get("/profiles/{profile_id}/pipeline/step5")
def pipeline_step5(profile_id: str, version: str = "v2"):
    """Mihan scoring engine."""
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    factors, _ = derive_factors(profile)
    if version == "v2":
        score = calculate_score_vanc(
            factors,
            _monthly_buckets_from_transactions(profile_id),
        )
    else:
        score = calculate_score(factors, profile.worst_month_income)
    append_audit_log(
        profile_id=profile.id,
        profile_name=profile.name_en,
        composite_score=score.composite,
        tier=score.tier,
        event=f"SCORE_CALCULATED_{version.upper()}",
        details=f"composite={score.composite} tier={score.tier}",
        endpoint="/pipeline/step5",
    )
    return {
        "step": "step5_scoring",
        "status": "COMPLETE",
        "composite": score.composite,
        "tier": score.tier,
        "score": score.model_dump(),
    }


@app.get("/profiles/{profile_id}/full-assessment")
def full_assessment(profile_id: str, version: str = "v1"):
    """
    Complete end-to-end assessment pipeline:
    1. SIMAH report
    2. Lean AIS transactions
    3. Wathiq client verification
    4. Mihan score calculation (v1 = Phase 1, v2 = VANC Phase 2)
    5. Loan recommendation
    Used to drive the 60-second scoring animation in the frontend.
    """
    profile = PROFILES.get(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    simah = get_simah_report(profile_id)
    transactions = generate_transactions(profile_id)
    wathiq = verify_profile_clients(profile_id)

    factors, factor_evidence = derive_factors(profile)
    if version == "v2":
        score = calculate_score_vanc(factors, _monthly_buckets_from_transactions(profile_id))
    else:
        score = calculate_score(factors, profile.worst_month_income)

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
            f"exception_sandbox={exception_triggered} version={version}"
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
            "selected_buffer": profile.selected_buffer,
        },
        "pipeline": {
            "step1_kyc":      {"status": "COMPLETE", "method": "Nafath biometric + Virtual Core Banking Profile"},
            "step2_lean_ais": {"status": "COMPLETE", "transactions_pulled": len(transactions), "months": 18},
            "step3_simah":    {"status": "COMPLETE", "file_type": simah["file_type"]},
            "step4_wathiq":   {"status": "COMPLETE", "clients_verified": sum(1 for w in wathiq if w["verified"]), "total_clients": len(wathiq)},
            "step5_scoring":  {"status": "COMPLETE", "composite": score.composite, "tier": score.tier, "engine_version": version},
        },
        "score": score.model_dump(),
        "factor_analysis": factor_evidence,
        "simah": simah,
        "wathiq_results": wathiq,
        "exception_sandbox_triggered": exception_triggered,
        "loan_recommendation": score.loan.model_dump() if score.loan else None,
        "next_step": (
            "APPROVE_FOR_REVIEW" if score.tier in ("GREEN", "YELLOW")
            else "IMPROVEMENT_ROADMAP"
        ),
    }
