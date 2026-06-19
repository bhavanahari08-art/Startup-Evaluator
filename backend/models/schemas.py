"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# ─── Auth Schemas ──────────────────────────────────────────────
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_email: str


# ─── Founder Profile ───────────────────────────────────────────
class FounderProfile(BaseModel):
    founder_location: int       # 0=Rural, 1=Urban
    education_level: int        # 0=Tier2/3, 1=Tier1
    funding_access: int         # 0=Low, 1=High
    gender: int                 # 0=Female, 1=Male
    patent_novelty: float       # 0–100
    research_support: float     # 0–100
    market_demand: float        # 0–100
    competitor_density: float   # 0–100
    team_experience: float      # 0–100


# ─── Evaluate Schemas ──────────────────────────────────────────
class EvaluateRequest(BaseModel):
    startup_idea: str
    profile: FounderProfile


class EvaluateResponse(BaseModel):
    feasibility_score: float
    feasibility_label: str
    genai_analysis: Dict[str, Any]
    papers: List[Dict[str, Any]]
    report_id: Optional[int] = None


# ─── SHAP Schemas ──────────────────────────────────────────────
class SHAPRequest(BaseModel):
    profile: FounderProfile


class SHAPFeature(BaseModel):
    feature: str
    importance: Optional[float] = None
    contribution: Optional[float] = None
    value: Optional[float] = None
    feature_type: str  # "sensitive" | "technical"


class SHAPResponse(BaseModel):
    global_explanations: List[SHAPFeature]
    local_explanations: List[SHAPFeature]
    prediction_score: float


# ─── DiCE Schemas ──────────────────────────────────────────────
class DiCERequest(BaseModel):
    profile: FounderProfile


class DiCEResponse(BaseModel):
    counterfactuals: List[Dict[str, Any]]
    current_prediction: int
    target_prediction: int
    message: str


# ─── Bias Schemas ──────────────────────────────────────────────
class BiasAuditRequest(BaseModel):
    sensitive_attribute: str  # gender | founder_location | education_level | funding_access


class GroupMetric(BaseModel):
    group_name: str
    group_value: int
    selection_rate: float
    true_positive_rate: float
    false_positive_rate: float
    count: int


class BiasAuditResponse(BaseModel):
    sensitive_attribute: str
    demographic_parity_difference: float
    equal_opportunity_difference: float
    equalized_odds_difference: float
    group_metrics: List[GroupMetric]
    intersectional_metrics: Optional[Dict[str, Any]] = None
    data_source: Optional[str] = None
    n_records: Optional[int] = None
    all_intersectional: Optional[Dict[str, Any]] = None
    data_transparency: Optional[Dict[str, Any]] = None
    trust_scores: Optional[Dict[str, Any]] = None


class MitigationRequest(BaseModel):
    sensitive_attribute: str


class MitigationResponse(BaseModel):
    baseline: Dict[str, Any]
    mitigated: Dict[str, Any]
    improvement_summary: str


# ─── Report Schemas ────────────────────────────────────────────
class TrustReportRequest(BaseModel):
    report_id: int


class ReportListItem(BaseModel):
    id: int
    startup_idea: str
    domain: Optional[str]
    feasibility_score: Optional[float]
    feasibility_label: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
