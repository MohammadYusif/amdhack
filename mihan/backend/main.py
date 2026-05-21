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
        details=f"expense={score.factors.expense_discipline} income={score.factors.income_stability} "
                f"diversity={score.factors.client_diversity} savings={score.factors.savings_behavior}",
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
            "Content-Disposition": f'attachment; filename="proof-of-income-{profile_id}.pdf"'
        },
    )
