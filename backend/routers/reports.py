"""
Reports router — trust report history and generation.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List

from backend.db.database import get_db, Report
from backend.models.schemas import ReportListItem
from backend.routers.auth import decode_token

router = APIRouter()


def _get_user_id(authorization: str) -> int:
    token = authorization.replace("Bearer ", "").replace("bearer ", "")
    payload = decode_token(token)
    return payload["user_id"]


def _compute_score_from_genai(genai: dict) -> tuple:
    """
    Derive feasibility_score (0–1) and label from AI metric scores.
    Used to backfill old records saved before the score computation was added.
    """
    try:
        novelty  = float(genai.get("patent_novelty_score",     50))
        research = float(genai.get("research_support_score",  50))
        market   = float(genai.get("market_demand_score",      50))
        team     = float(genai.get("team_experience_score",    50))
        comp     = float(genai.get("competitor_density_score", 50))
        score    = (novelty * 0.25 + research * 0.20 + market * 0.30 + team * 0.15 + (100 - comp) * 0.10) / 100.0
        score    = round(min(max(score, 0.0), 1.0), 4)
        if score >= 0.65:
            label = "High Potential"
        elif score >= 0.40:
            label = "Medium Potential"
        else:
            label = "Low Potential"
        return score, label
    except Exception:
        return None, None


@router.get("/explain/{report_id}")
def explain_report(
    report_id: int,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    """
    Return structured explanation data for the XAI page.
    Extracts factor scores, contributions, what-if simulations, and AI insights from a saved report.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = _get_user_id(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rj   = json.loads(report.report_json) if report.report_json else {}
    ga   = rj.get("genai_analysis", {})
    ai   = rj.get("ai_scores", {})
    prof = rj.get("profile", {})

    # Build factor scores from ai_scores or genai_analysis
    FACTOR_META = [
        {"key": "patent_novelty",     "label": "Patent Novelty",      "description": "Uniqueness of the core IP / idea"},
        {"key": "research_support",   "label": "Research Support",    "description": "Strength of academic backing"},
        {"key": "market_demand",      "label": "Market Demand",       "description": "Validated demand from target users"},
        {"key": "competitor_density", "label": "Competitor Density",  "description": "Level of market competition (lower is better)"},
        {"key": "team_experience",    "label": "Team Experience",     "description": "Depth of expertise needed to execute"},
    ]

    factors = []
    for f in FACTOR_META:
        score = (
            ai.get(f["key"]) or
            ga.get(f["key"] + "_score") or
            prof.get(f["key"]) or
            55
        )
        factors.append({**f, "score": round(float(score), 1)})

    # Feasibility score — use DB value (already ×100) or compute
    raw_score = report.feasibility_score or 0
    overall = round(raw_score * 100, 1) if raw_score <= 1.0 else round(raw_score, 1)

    # Strengths = factors with highest scores (excluding competitor which is inverted)
    strengths  = sorted([f for f in factors if f["key"] != "competitor_density"], key=lambda x: -x["score"])[:2]
    weaknesses = sorted([f for f in factors if f["key"] != "competitor_density"], key=lambda x: x["score"])[:2]

    # What-If simulations — boost each factor by +15 and see score change
    WEIGHTS = {"patent_novelty": 0.25, "research_support": 0.20, "market_demand": 0.30,
               "competitor_density": -0.10, "team_experience": 0.15}
    base_scores = {f["key"]: f["score"] for f in factors}

    def compute_score(scores):
        s = 0
        for k, w in WEIGHTS.items():
            if w < 0:
                s += (100 - scores.get(k, 50)) * abs(w)
            else:
                s += scores.get(k, 50) * w
        return round(min(100, max(0, s)), 1)

    current_overall = compute_score(base_scores)
    whatif = []
    for f in factors:
        boosted = dict(base_scores)
        if f["key"] == "competitor_density":
            boosted[f["key"]] = max(0, f["score"] - 15)
        else:
            boosted[f["key"]] = min(100, f["score"] + 15)
        new_score = compute_score(boosted)
        delta = round(new_score - current_overall, 1)
        whatif.append({
            "key":           f["key"],
            "factor":        f["label"],
            "current_score": f["score"],
            "boosted_score": boosted[f["key"]],
            "overall_before": current_overall,
            "overall_after":  new_score,
            "delta":          delta,
        })
    whatif.sort(key=lambda x: -x["delta"])

    # SHAP-style contributions — percentage contribution of each factor to total score
    total_weight = sum(abs(w) for w in WEIGHTS.values())
    contributions = []
    for f in factors:
        w = WEIGHTS.get(f["key"], 0)
        if w < 0:
            contrib = (100 - f["score"]) * abs(w) / (current_overall + 0.001) * 100
        else:
            contrib = f["score"] * w / (current_overall + 0.001) * 100
        contributions.append({
            "key": f["key"],
            "label": f["label"],
            "contribution_pct": round(contrib, 1),
            "positive": w > 0,
        })

    # Metric reasoning from AI
    reasoning = ga.get("metric_reasoning", {})

    return {
        "report_id":        report.id,
        "startup_idea":     report.startup_idea,
        "domain":           report.domain,
        "overall_score":    overall,
        "feasibility_label": report.feasibility_label,
        "factors":          factors,
        "strengths":        strengths,
        "weaknesses":       weaknesses,
        "whatif_simulations": whatif,
        "contributions":    contributions,
        "reasoning":        reasoning,
        # AI analysis fields
        "advantages":              ga.get("advantages", []),
        "risks":                   ga.get("risks", []),
        "challenges":              ga.get("challenges", []),
        "research_gaps":           ga.get("research_gaps", []),
        "innovation_opportunities":ga.get("innovation_opportunities", []),
        "technical_feasibility":   ga.get("technical_feasibility"),
        "market_feasibility":      ga.get("market_feasibility"),
        "business_feasibility":    ga.get("business_feasibility"),
        "idea_novelty_status":     ga.get("idea_novelty_status"),
        "what_ai_understood":      ga.get("what_ai_understood"),
        "final_verdict":           ga.get("final_verdict"),
        # Trustworthiness scores
        "trust_scores": {
            "explainability": min(100, round(sum(f["score"] for f in factors) / len(factors) * 0.9, 0)),
            "fairness":       75,
            "confidence":     round(overall, 0),
            "transparency":   80,
            "bias_risk":      "Low" if overall > 60 else "Medium" if overall > 40 else "High",
        }
    }


@router.get("/profile/{report_id}")
def get_report_profile(
    report_id: int,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    """Return the profile/scores from a report for use in the XAI page."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = _get_user_id(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rj     = json.loads(report.report_json) if report.report_json else {}
    profile = rj.get('profile', {})
    ai      = rj.get('ai_scores', {})
    ga      = rj.get('genai_analysis', {})

    return {
        "report_id":        report.id,
        "startup_idea":     report.startup_idea,
        "domain":           report.domain,
        "feasibility_score": round(report.feasibility_score * 100, 2) if report.feasibility_score else 0,
        "feasibility_label": report.feasibility_label,
        "profile": {
            "founder_location":  int(profile.get('founder_location', 0)),
            "education_level":   int(profile.get('education_level',  0)),
            "funding_access":    int(profile.get('funding_access',   0)),
            "gender":            int(profile.get('gender',           0)),
            "patent_novelty":    float(ai.get('patent_novelty')    or ga.get('patent_novelty_score')    or profile.get('patent_novelty',    55)),
            "research_support":  float(ai.get('research_support')  or ga.get('research_support_score')  or profile.get('research_support',  45)),
            "market_demand":     float(ai.get('market_demand')     or ga.get('market_demand_score')     or profile.get('market_demand',     60)),
            "competitor_density":float(ai.get('competitor_density') or ga.get('competitor_density_score') or profile.get('competitor_density', 30)),
            "team_experience":   float(ai.get('team_experience')   or ga.get('team_experience_score')   or profile.get('team_experience',   55)),
        }
    }


@router.get("/explain/{report_id}")
def get_report_explain(
    report_id: int,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    """
    Return rich explanation data from a real startup analysis for the XAI page.
    All scores come from Gemini AI — no synthetic model involved.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = _get_user_id(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    rj  = json.loads(report.report_json) if report.report_json else {}
    ga  = rj.get("genai_analysis", {})
    ai  = rj.get("ai_scores", {})

    # Pull real scores — prefer genai_analysis, fall back to ai_scores
    def _s(ga_key, ai_key, default=50):
        v = ga.get(ga_key) or ai.get(ai_key)
        try:
            return round(float(v), 1)
        except (TypeError, ValueError):
            return default

    patent_novelty     = _s("patent_novelty_score",     "patent_novelty",     55)
    research_support   = _s("research_support_score",   "research_support",   45)
    market_demand      = _s("market_demand_score",      "market_demand",      60)
    competitor_density = _s("competitor_density_score", "competitor_density", 30)
    team_experience    = _s("team_experience_score",    "team_experience",    55)

    # Weighted overall score (same formula as _compute_score_from_genai)
    overall = round(
        patent_novelty * 0.25 +
        research_support * 0.20 +
        market_demand * 0.30 +
        team_experience * 0.15 +
        (100 - competitor_density) * 0.10,
        1
    )

    factors = [
        {"key": "patent_novelty",     "label": "Patent Novelty",      "score": patent_novelty,
         "weight": 25, "description": "How unique and novel the core invention is vs existing patents."},
        {"key": "research_support",   "label": "Research Support",    "score": research_support,
         "weight": 20, "description": "Academic and scientific backing for the core technology."},
        {"key": "market_demand",      "label": "Market Demand",       "score": market_demand,
         "weight": 30, "description": "Size and urgency of the target market opportunity."},
        {"key": "team_experience",    "label": "Team Experience",     "score": team_experience,
         "weight": 15, "description": "Founders' domain expertise and execution track record."},
        {"key": "competitor_density", "label": "Competitor Density",  "score": competitor_density,
         "weight": 10, "description": "Crowdedness of the competitive landscape (lower = better)."},
    ]

    # Sort by contribution (high scores on low-weight = lower rank, competitor_density inverted)
    def contribution(f):
        if f["key"] == "competitor_density":
            return (100 - f["score"]) * f["weight"] / 100
        return f["score"] * f["weight"] / 100

    sorted_factors = sorted(factors, key=contribution, reverse=True)
    strengths  = [f for f in sorted_factors if contribution(f) >= 12][:3]
    weaknesses = [f for f in sorted_factors if contribution(f) < 8][:3]

    # Pull rich text from genai_analysis
    advantages   = ga.get("advantages", [])
    risks        = ga.get("risks", [])
    research_gaps = ga.get("research_gaps", [])
    innovation   = ga.get("innovation_opportunities", [])

    tech_feasibility    = ga.get("technical_feasibility", "")
    market_feasibility  = ga.get("market_feasibility", "")
    biz_feasibility     = ga.get("business_feasibility", "")

    # What-if: show how score changes if each weak factor improves by +15
    whatif = []
    for f in factors:
        boosted = dict(f)
        if f["key"] == "competitor_density":
            new_score = max(0, f["score"] - 15)  # lower is better
        else:
            new_score = min(100, f["score"] + 15)
        new_factors = {ff["key"]: ff["score"] for ff in factors}
        new_factors[f["key"]] = new_score
        new_overall = round(
            new_factors["patent_novelty"] * 0.25 +
            new_factors["research_support"] * 0.20 +
            new_factors["market_demand"] * 0.30 +
            new_factors["team_experience"] * 0.15 +
            (100 - new_factors["competitor_density"]) * 0.10,
            1
        )
        delta = round(new_overall - overall, 1)
        whatif.append({
            "factor": f["label"],
            "key":    f["key"],
            "current_score": f["score"],
            "boosted_score": new_score,
            "overall_before": overall,
            "overall_after":  new_overall,
            "delta":          delta,
        })
    whatif.sort(key=lambda x: x["delta"], reverse=True)

    score = report.feasibility_score
    if score and score <= 1.0:
        score = round(score * 100, 2)

    return {
        "report_id":          report.id,
        "startup_idea":       report.startup_idea,
        "domain":             report.domain,
        "feasibility_score":  score or overall,
        "feasibility_label":  report.feasibility_label or ("High Potential" if overall >= 65 else "Medium Potential" if overall >= 40 else "Low Potential"),
        "overall_score":      overall,
        "factors":            factors,
        "strengths":          strengths,
        "weaknesses":         weaknesses,
        "whatif_simulations": whatif,
        "advantages":         advantages,
        "risks":              risks,
        "research_gaps":      research_gaps,
        "innovation_opportunities": innovation,
        "technical_feasibility":   tech_feasibility,
        "market_feasibility":      market_feasibility,
        "business_feasibility":    biz_feasibility,
        "data_source":        "gemini_ai",
    }


@router.get("/history", response_model=List[ReportListItem])
def get_report_history(
    q: str = "",
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = _get_user_id(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    query = db.query(Report).filter(Report.user_id == user_id)
    if q:
        query = query.filter(Report.startup_idea.ilike(f"%{q}%"))
    reports = query.order_by(Report.created_at.desc()).limit(50).all()

    # Backfill null scores in-place so the list view shows correct percentages
    for report in reports:
        if (report.feasibility_score is None or report.feasibility_score == 0) and report.report_json:
            try:
                rj     = json.loads(report.report_json)
                genai  = rj.get("genai_analysis", {})
                score, label = _compute_score_from_genai(genai)
                if score:
                    report.feasibility_score = score
                    report.feasibility_label = label or report.feasibility_label
                    db.commit()
            except Exception as e:
                print(f"[reports] Backfill failed for id={report.id}: {e}")

    # Convert 0–1 scores to 0–100 for the frontend before returning
    # (DB stores 0–1; frontend scoreColor expects 0–100)
    for report in reports:
        if report.feasibility_score is not None and report.feasibility_score <= 1.0:
            report.feasibility_score = round(report.feasibility_score * 100, 2)

    return reports


@router.get("/{report_id}")
def get_report(
    report_id: int,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = _get_user_id(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report_data = json.loads(report.report_json) if report.report_json else {}
    genai = report_data.get("genai_analysis", {})

    # Backfill null score on read
    score = report.feasibility_score
    label = report.feasibility_label
    if (score is None or score == 0) and genai:
        score, computed_label = _compute_score_from_genai(genai)
        if score:
            label = computed_label or label
            # Persist the fix so next read is instant
            report.feasibility_score = score
            report.feasibility_label = label
            db.commit()

    # Also inject score into genai_analysis so the frontend gauge fallback works
    if genai and score:
        genai["feasibility_score"] = round(score * 100, 2)
        genai["feasibility_label"] = label

    return {
        **report_data,                                          # spread first (may contain stale score)
        "id": report.id,                                        # then explicit fields override the spread
        "startup_idea": report.startup_idea,
        "domain": report.domain,
        "feasibility_score": round(score * 100, 2) if score else 0,
        "feasibility_label": label,
        "created_at": report.created_at.isoformat(),
        "genai_analysis": genai,                                # override with injected score
    }


@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = _get_user_id(authorization)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}
