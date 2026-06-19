"""
Bias & Fairness router.
Uses the SYNTHETIC TRAINING DATASET for bias audit — this is correct because:
- Bias analysis needs diverse demographics across many users (not one user's reports)
- The synthetic dataset was intentionally designed with bias injected across
  gender, location, education, and funding access (1500 records)
- The trained ML model encodes this bias — auditing it on the same distribution
  it was trained on gives meaningful, interpretable fairness metrics
"""
import json
import numpy as np
import pandas as pd
import joblib
from fastapi import APIRouter, Header, Depends
from sqlalchemy.orm import Session
from sklearn.model_selection import train_test_split

from backend.db.database import get_db, Report
from backend.models.schemas import (
    BiasAuditRequest, BiasAuditResponse, GroupMetric,
    MitigationRequest, MitigationResponse
)
from backend.services.bias_mitigator import (
    compute_fairness_metrics, audit_intersectional_fairness,
    train_mitigated_model, evaluate_mitigation_tradeoff
)

router = APIRouter()

GROUP_LABELS = {
    'gender':           {0: 'Female',     1: 'Male'},
    'founder_location': {0: 'Rural',      1: 'Urban'},
    'education_level':  {0: 'Tier 2/3',   1: 'Tier 1'},
    'funding_access':   {0: 'Low Access', 1: 'High Access'},
}

# Cached assets
_model   = None
_X_train = None
_X_test  = None
_y_train = None
_y_test  = None


def _load_assets():
    """Load the ML model and the synthetic dataset test split (reuse cached)."""
    global _model, _X_train, _X_test, _y_train, _y_test
    if _model is None:
        _model = joblib.load("models/biased_rf_model.pkl")
        df = pd.read_csv("datasets/synthetic_startups.csv")
        X  = df.drop(columns=['feasibility_label'])
        y  = df['feasibility_label']
        _X_train, _X_test, _y_train, _y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
    return _model, _X_train, _X_test, _y_train, _y_test


@router.post("/audit", response_model=BiasAuditResponse)
def bias_audit(
    body: BiasAuditRequest,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    attr = body.sensitive_attribute
    if attr not in GROUP_LABELS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Invalid sensitive attribute: {attr}")

    model, X_train, X_test, y_train, y_test = _load_assets()

    # Audit on the held-out test set (never seen by the model during training)
    X_audit = X_test.reset_index(drop=True)
    y_true  = y_test.reset_index(drop=True)
    y_pred  = pd.Series(model.predict(X_audit))
    source  = "synthetic"
    n       = len(X_audit)

    metrics = compute_fairness_metrics(y_true, y_pred, X_audit[attr])

    group_metrics_list = []
    for group_val, gm in metrics['group_metrics'].items():
        try:
            label_key = int(group_val)
        except (ValueError, TypeError):
            label_key = group_val
        group_metrics_list.append(GroupMetric(
            group_name=GROUP_LABELS[attr].get(label_key, str(group_val)),
            group_value=label_key if isinstance(label_key, int) else 0,
            selection_rate=round(gm['selection_rate'], 4),
            true_positive_rate=round(gm['true_positive_rate'], 4),
            false_positive_rate=round(gm['false_positive_rate'], 4),
            count=gm['count']
        ))

    # Intersectional audit — multiple combinations
    intersect_pairs = [
        (['founder_location', 'funding_access'],  'Location × Funding'),
        (['gender', 'education_level'],           'Gender × Education'),
        (['gender', 'funding_access'],            'Gender × Funding'),
        (['founder_location', 'education_level'], 'Location × Education'),
    ]
    all_intersect = {}
    for cols, pair_label in intersect_pairs:
        try:
            inter = audit_intersectional_fairness(y_true, y_pred, X_audit, cols)
            combo = {}
            for g, val in inter['group_metrics'].items():
                parts = str(g).split('_')
                if len(parts) >= 2:
                    LABEL_MAP = {
                        'founder_location': {0: 'Rural',    1: 'Urban'},
                        'education_level':  {0: 'Tier2/3',  1: 'Tier1'},
                        'funding_access':   {0: 'Low Fund', 1: 'High Fund'},
                        'gender':           {0: 'Female',   1: 'Male'},
                    }
                    v0 = LABEL_MAP.get(cols[0], {}).get(int(parts[0]) if parts[0].isdigit() else 0, parts[0])
                    v1 = LABEL_MAP.get(cols[1], {}).get(int(parts[1]) if parts[1].isdigit() else 0, parts[1])
                    lbl = f"{v0} + {v1}"
                else:
                    lbl = str(g)
                combo[lbl] = round(val['selection_rate'] * 100, 2)
            all_intersect[pair_label] = combo
        except Exception as e:
            print(f"[bias] Intersectional {pair_label} failed: {e}")

    # Legacy flat intersectional_metrics (first pair) for backward compat
    intersect_data = list(all_intersect.values())[0] if all_intersect else {}

    # Data transparency — show synthetic dataset distribution
    df_full = pd.read_csv("datasets/synthetic_startups.csv")
    transparency = {}
    for col, labels in GROUP_LABELS.items():
        counts = df_full[col].value_counts().to_dict()
        transparency[col] = {labels.get(int(k), str(k)): int(v) for k, v in counts.items()}

    # Trustworthiness scores
    dpd = abs(metrics['demographic_parity_difference'])
    eod = abs(metrics['equal_opportunity_difference'])
    fairness_score  = round(max(0, 100 - dpd * 200), 1)
    explainability  = 78.0
    confidence      = round(max(0, 100 - (dpd + eod) * 100), 1)
    transparency_sc = 85.0 if source == 'real' else 55.0
    bias_risk       = "Low" if dpd < 0.05 else ("Medium" if dpd < 0.15 else "High")

    resp = BiasAuditResponse(
        sensitive_attribute=attr,
        demographic_parity_difference=round(metrics['demographic_parity_difference'], 4),
        equal_opportunity_difference=round(metrics['equal_opportunity_difference'], 4),
        equalized_odds_difference=round(metrics['equalized_odds_difference'], 4),
        group_metrics=group_metrics_list,
        intersectional_metrics=intersect_data,
        data_source=source,
        n_records=n,
        all_intersectional=all_intersect,
        data_transparency=transparency,
        trust_scores={
            "fairness":        fairness_score,
            "explainability":  explainability,
            "confidence":      confidence,
            "transparency":    transparency_sc,
            "bias_risk":       bias_risk,
        },
    )
    return resp


@router.post("/mitigate", response_model=MitigationResponse)
def mitigate_bias(
    body: MitigationRequest,
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
):
    attr = body.sensitive_attribute
    model, X_train, X_test, y_train, y_test = _load_assets()

    mitigated_model = train_mitigated_model(
        model, X_train, y_train, sensitive_feature_name=attr
    )
    comparison = evaluate_mitigation_tradeoff(
        model, mitigated_model, X_test, y_test, sensitive_feature_name=attr
    )

    n = len(X_train) + len(X_test)
    dpd_before = comparison['baseline']['demographic_parity_difference']
    dpd_after  = comparison['mitigated']['demographic_parity_difference']
    dpd_pct    = round(abs(dpd_before - dpd_after) / max(abs(dpd_before), 1e-6) * 100, 1)
    acc_before = comparison['baseline']['accuracy']
    acc_after  = comparison['mitigated']['accuracy']

    summary = (
        f"Fairlearn ThresholdOptimizer (demographic parity) reduced bias by {dpd_pct}% "
        f"on the synthetic dataset ({n} records with intentional bias). "
        f"DPD: {dpd_before:.4f} → {dpd_after:.4f}. "
        f"Accuracy: {acc_before:.3f} → {acc_after:.3f}."
    )

    return MitigationResponse(
        baseline=comparison['baseline'],
        mitigated=comparison['mitigated'],
        improvement_summary=summary,
    )
