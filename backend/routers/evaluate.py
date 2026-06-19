"""
Evaluate router — startup idea evaluation using ML + Gemini AI.
Uses the same get_startup_analysis() as the /startup endpoint for consistent results.
"""
import os
import json
import pandas as pd
import joblib
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from backend.db.database import get_db, Report
from backend.models.schemas import EvaluateRequest, EvaluateResponse
from backend.services.research_intel import search_semantic_scholar, get_startup_analysis
from backend.routers.auth import decode_token

router = APIRouter()

_model = None
_model_attr = None
_is_mitigated = False

def get_model():
    global _model, _model_attr, _is_mitigated

    # Force reload if we are using the biased model but a mitigated one was just created
    if not _is_mitigated and os.path.exists("models/mitigated_threshold_opt.pkl"):
        _model = None

    if _model is None:
        if os.path.exists("models/mitigated_threshold_opt.pkl"):
            data = joblib.load("models/mitigated_threshold_opt.pkl")
            if isinstance(data, dict) and "model" in data:
                _model = data["model"]
                _model_attr = data["attr"]
                _is_mitigated = True
            else:
                _model = data
                _model_attr = "gender"
                _is_mitigated = True
        else:
            _model = joblib.load("models/biased_rf_model.pkl")
            _model_attr = None
            _is_mitigated = False
    return _model, _model_attr, _is_mitigated


def profile_to_df(profile) -> pd.DataFrame:
    return pd.DataFrame([{
        'founder_location': profile.founder_location,
        'education_level':  profile.education_level,
        'funding_access':   profile.funding_access,
        'gender':           profile.gender,
        'patent_novelty':   profile.patent_novelty,
        'research_support': profile.research_support,
        'market_demand':    profile.market_demand,
        'competitor_density': profile.competitor_density,
        'team_experience':  profile.team_experience,
    }])


# Detect hardware vs software (same logic as startup router)
_HW_KW = {
    'iot','sensor','arduino','raspberry','embedded','microcontroller','hardware',
    'robot','drone','camera','gps','rfid','bluetooth','pcb','circuit','motor',
    'servo','actuator','wearable','device','3d print','fpga','edge device',
}
def _detect_type(idea: str) -> str:
    il = idea.lower()
    return "hardware" if any(k in il for k in _HW_KW) else "software"


@router.post("", response_model=EvaluateResponse)
async def evaluate_startup(
    body: EvaluateRequest,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    model, attr, is_mitigated = get_model()

    # Step 1 — Use the SAME analysis function as /startup for consistent results
    papers       = search_semantic_scholar(body.startup_idea, limit=5)
    project_type = _detect_type(body.startup_idea)
    # Default mode "startup" for the /evaluate endpoint (it has a full founder profile)
    analysis = get_startup_analysis(body.startup_idea, papers, mode="startup", project_type=project_type)

    # Step 2 — ML input: use AI-generated scores + user profile
    ai_novelty  = float(analysis.get("patent_novelty_score",      body.profile.patent_novelty))
    ai_research = float(analysis.get("research_support_score",    body.profile.research_support))
    ai_demand   = float(analysis.get("market_demand_score",       body.profile.market_demand))
    ai_compet   = float(analysis.get("competitor_density_score",  body.profile.competitor_density))
    ai_team     = float(analysis.get("team_experience_score",     body.profile.team_experience))

    ml_input = pd.DataFrame([{
        'founder_location':  body.profile.founder_location,
        'education_level':   body.profile.education_level,
        'funding_access':    body.profile.funding_access,
        'gender':            body.profile.gender,
        'patent_novelty':    ai_novelty,
        'research_support':  ai_research,
        'market_demand':     ai_demand,
        'competitor_density':ai_compet,
        'team_experience':   ai_team,
    }])

    # Step 3 — ML prediction (probability × 100 for display)
    if is_mitigated:
        sensitive_vals = ml_input[attr] if attr else ml_input['gender']
        pred = int(model.predict(ml_input, sensitive_features=sensitive_vals)[0])
        prob = float(model.estimator_.predict_proba(ml_input)[0][1])
    else:
        prob = float(model.predict_proba(ml_input)[0][1])
        pred = int(model.predict(ml_input)[0])

    label = "High Potential" if pred == 1 else ("Medium Potential" if prob > 0.35 else "Low Potential")

    # Step 4 — Save report with full profile + ai_scores
    report_id = None
    try:
        if authorization and authorization.lower() != "":
            token   = authorization.replace("Bearer ", "").replace("bearer ", "")
            payload = decode_token(token)
            report  = Report(
                user_id=payload["user_id"],
                startup_idea=body.startup_idea[:500],
                domain=analysis.get("domain_classification", ""),
                feasibility_score=prob,
                feasibility_label=label,
                report_json=json.dumps({
                    "genai_analysis": analysis,
                    "papers": papers,
                    "profile": body.profile.model_dump(),
                    "ai_scores": {
                        "patent_novelty":     ai_novelty,
                        "research_support":   ai_research,
                        "market_demand":      ai_demand,
                        "competitor_density": ai_compet,
                        "team_experience":    ai_team,
                    },
                    "feasibility_score": prob,
                    "feasibility_label": label,
                    "project_type": project_type,
                })
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            report_id = report.id
    except Exception as e:
        print(f"Could not save report: {e}")

    return EvaluateResponse(
        feasibility_score=round(prob * 100, 2),
        feasibility_label=label,
        genai_analysis=analysis,
        papers=papers,
        report_id=report_id,
    )
