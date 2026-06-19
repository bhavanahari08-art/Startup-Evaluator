"""
Explainability router — SHAP global/local + DiCE counterfactuals.
"""
import pandas as pd
import joblib
import numpy as np
from fastapi import APIRouter
from sklearn.model_selection import train_test_split

from backend.models.schemas import SHAPRequest, SHAPResponse, SHAPFeature, DiCERequest, DiCEResponse
from backend.services.explainability import get_shap_explanations, get_dice_counterfactuals

router = APIRouter()

_model = None
_X_train = None
_y_train = None
_X_test = None

SENSITIVE_FEATURES = {'founder_location', 'education_level', 'funding_access', 'gender'}
FEATURE_LABELS = {
    'founder_location': 'Founder Location',
    'education_level': 'Education Level',
    'funding_access': 'Funding Access',
    'gender': 'Gender',
    'patent_novelty': 'Patent Novelty',
    'research_support': 'Research Support',
    'market_demand': 'Market Demand',
    'competitor_density': 'Competitor Density',
    'team_experience': 'Team Experience',
}


def _load_assets():
    global _model, _X_train, _y_train, _X_test
    if _model is None:
        _model = joblib.load("models/biased_rf_model.pkl")
        df = pd.read_csv("datasets/synthetic_startups.csv")
        X = df.drop(columns=['feasibility_label'])
        y = df['feasibility_label']
        _X_train, _X_test, _y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)
    return _model, _X_train, _y_train


def _profile_to_df(profile) -> pd.DataFrame:
    return pd.DataFrame([{
        'founder_location': profile.founder_location,
        'education_level': profile.education_level,
        'funding_access': profile.funding_access,
        'gender': profile.gender,
        'patent_novelty': profile.patent_novelty,
        'research_support': profile.research_support,
        'market_demand': profile.market_demand,
        'competitor_density': profile.competitor_density,
        'team_experience': profile.team_experience,
    }])


@router.post("/shap", response_model=SHAPResponse)
def shap_explanations(body: SHAPRequest):
    model, X_train, _ = _load_assets()
    input_df = _profile_to_df(body.profile)

    global_df, local_df = get_shap_explanations(model, input_df, X_train)
    prob = float(model.predict_proba(input_df)[0][1])

    global_features = [
        SHAPFeature(
            feature=row['Feature'],
            importance=float(row['Importance']),
            feature_type="sensitive" if row['Feature'] in SENSITIVE_FEATURES else "technical"
        )
        for _, row in global_df.iterrows()
    ]

    local_features = [
        SHAPFeature(
            feature=row['Feature'],
            contribution=float(row['Contribution']),
            value=float(row['Value']),
            feature_type="sensitive" if row['Feature'] in SENSITIVE_FEATURES else "technical"
        )
        for _, row in local_df.iterrows()
    ]

    return SHAPResponse(
        global_explanations=global_features,
        local_explanations=local_features,
        prediction_score=round(prob * 100, 2)
    )


@router.post("/dice", response_model=DiCEResponse)
def dice_counterfactuals(body: DiCERequest):
    model, X_train, y_train = _load_assets()
    input_df = _profile_to_df(body.profile)

    current_pred = int(model.predict(input_df)[0])
    target_pred = 1 - current_pred

    cf_df = get_dice_counterfactuals(model, input_df, X_train, y_train)

    if cf_df is not None:
        # Drop label column from display
        display_cols = [c for c in cf_df.columns if c != 'feasibility_label']
        records = cf_df[display_cols].to_dict(orient='records')
        msg = (
            "To flip to HIGH POTENTIAL, consider these minimal changes to your technical metrics."
            if target_pred == 1
            else "Your startup is already HIGH POTENTIAL. These show alternate borderline scenarios."
        )
    else:
        records = []
        msg = "Could not generate counterfactuals. Try adjusting your profile."

    return DiCEResponse(
        counterfactuals=records,
        current_prediction=current_pred,
        target_prediction=target_pred,
        message=msg
    )
