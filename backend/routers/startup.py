"""
Startup Analyzer router — dedicated startup idea analysis endpoint.
Supports mode: "startup" | "hackathon" | "project"
Auto-detects hardware vs software project type.
Now collects founder profile (protected attributes) for bias/XAI analysis.
"""
import os
import json
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.db.database import get_db, Report
from backend.services.research_intel import search_all_research, get_startup_analysis
from backend.routers.evaluate import get_model
import pandas as pd

router = APIRouter()

# Hardware indicator keywords — if idea contains these, it's a hardware project
_HARDWARE_KEYWORDS = {
    'iot','sensor','arduino','raspberry','embedded','microcontroller','hardware',
    'robot','drone','camera','gps','rfid','bluetooth','zigbee','lora','pcb',
    'circuit','motor','servo','actuator','wearable','device','prototype',
    'raspberry pi','esp32','esp8266','3d print','cnc','fpga','edge device',
    'smart device','physical','heartbeat','pulse','temperature sensor','accelerometer',
    'gyroscope','ultrasonic','infrared','lidar','sonar','haptic',
}

def _detect_project_type(idea: str) -> str:
    """Returns 'hardware' or 'software' based on idea content."""
    idea_lower = idea.lower()
    hw_matches = sum(1 for kw in _HARDWARE_KEYWORDS if kw in idea_lower)
    return "hardware" if hw_matches >= 1 else "software"


class StartupAnalyzeRequest(BaseModel):
    startup_idea: str
    mode: str = "startup"   # "startup" | "hackathon" | "project"
    # Optional founder profile for bias/XAI analysis
    gender: int = 0            # 0=Female, 1=Male
    founder_location: int = 0  # 0=Rural, 1=Urban
    education_level: int = 0   # 0=Tier 2/3, 1=Tier 1
    funding_access: int = 0    # 0=Low, 1=High


class StartupAnalyzeResponse(BaseModel):
    idea: str
    mode: str
    project_type: str          # "hardware" | "software"
    analysis: Dict[str, Any]
    papers: List[Dict[str, Any]]
    patents: List[Dict[str, Any]]
    report_id: Optional[int] = None


def _try_decode_token(authorization: str):
    if not authorization:
        return None, "no token"
    try:
        from backend.routers.auth import decode_token
        token = authorization.replace("Bearer ", "").replace("bearer ", "")
        payload = decode_token(token)
        return payload["user_id"], None
    except Exception as e:
        return None, str(e)


@router.post("", response_model=StartupAnalyzeResponse)
async def analyze_startup(
    body: StartupAnalyzeRequest,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    idea = body.startup_idea.strip()
    mode = body.mode.lower() if body.mode else "startup"

    # Auto-detect hardware vs software
    project_type = _detect_project_type(idea)

    # Founder profile (for bias/XAI analysis)
    profile = {
        "gender":           body.gender,
        "founder_location": body.founder_location,
        "education_level":  body.education_level,
        "funding_access":   body.funding_access,
    }

    # 1. Search research papers + patent links
    results = search_all_research(idea, paper_limit=10)
    papers  = results["papers"]
    patents = results["patents"]

    # 2. Deep AI analysis — mode + project_type aware
    analysis = get_startup_analysis(idea, papers, mode=mode, project_type=project_type)
    analysis["patent_links"] = patents
    analysis["project_type"] = project_type

    # 3. Derive a composite feasibility score using the ML Model!
    novelty   = float(analysis.get("patent_novelty_score",     50))
    research  = float(analysis.get("research_support_score",  50))
    market    = float(analysis.get("market_demand_score",      50))
    team      = float(analysis.get("team_experience_score",    50))
    comp      = float(analysis.get("competitor_density_score", 50))
    
    ml_input = pd.DataFrame([{
        'founder_location':  body.founder_location,
        'education_level':   body.education_level,
        'funding_access':    body.funding_access,
        'gender':            body.gender,
        'patent_novelty':    novelty,
        'research_support':  research,
        'market_demand':     market,
        'competitor_density':comp,
        'team_experience':   team,
    }])
    
    model, attr, is_mitigated = get_model()
    
    if is_mitigated:
        sensitive_vals = ml_input[attr] if attr else ml_input['gender']
        pred = int(model.predict(ml_input, sensitive_features=sensitive_vals)[0])
        prob = float(model.estimator_.predict_proba(ml_input)[0][1])
    else:
        prob = float(model.predict_proba(ml_input)[0][1])
        pred = int(model.predict(ml_input)[0])
        
    composite = prob

    novelty_status = analysis.get("idea_novelty_status", "")
    if composite >= 0.65:
        feas_label = "High Potential"
    elif composite >= 0.40:
        feas_label = "Medium Potential"
    else:
        feas_label = "Low Potential"

    # 4. Persist report if authenticated
    report_id = None
    user_id, _ = _try_decode_token(authorization)
    if user_id:
        try:
            report = Report(
                user_id=user_id,
                startup_idea=idea[:500],
                domain=analysis.get("domain_classification", ""),
                feasibility_score=composite,
                feasibility_label=feas_label,
                report_json=json.dumps({
                    "genai_analysis": analysis,
                    "papers": papers,
                    "patents": patents,
                    "mode": mode,
                    "profile": {
                        **profile,
                        "patent_novelty":     analysis.get("patent_novelty_score",    55),
                        "research_support":   analysis.get("research_support_score",  45),
                        "market_demand":      analysis.get("market_demand_score",      60),
                        "competitor_density": analysis.get("competitor_density_score", 30),
                        "team_experience":    analysis.get("team_experience_score",    55),
                    },
                    "ai_scores": {
                        "patent_novelty":     analysis.get("patent_novelty_score",    55),
                        "research_support":   analysis.get("research_support_score",  45),
                        "market_demand":      analysis.get("market_demand_score",      60),
                        "competitor_density": analysis.get("competitor_density_score", 30),
                        "team_experience":    analysis.get("team_experience_score",    55),
                    },
                    "feasibility_score": composite,
                    "feasibility_label": feas_label,
                }),
            )
            db.add(report)
            db.commit()
            db.refresh(report)
            report_id = report.id
        except Exception as e:
            print(f"[startup] Could not save report: {e}")

    # Attach derived scores into analysis so frontend can display them
    analysis["feasibility_score"] = round(composite * 100, 2)
    analysis["feasibility_label"] = feas_label

    return StartupAnalyzeResponse(
        idea=idea,
        mode=mode,
        project_type=project_type,
        analysis=analysis,
        papers=papers,
        patents=patents,
        report_id=report_id,
    )
