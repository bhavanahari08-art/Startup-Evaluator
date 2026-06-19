import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from fairlearn.postprocessing import ThresholdOptimizer
from fairlearn.metrics import (
    demographic_parity_difference,
    equalized_odds_difference,
    selection_rate,
    true_positive_rate,
    false_positive_rate
)
import joblib
import os

def compute_fairness_metrics(y_true, y_pred, sensitive_features):
    """
    Compute core fairness metrics for a set of predictions and sensitive features.
    """
    # Reset indices to avoid alignment errors from train/test splits
    y_true           = pd.Series(y_true.values if hasattr(y_true, 'values') else y_true).reset_index(drop=True)
    y_pred           = pd.Series(y_pred.values if hasattr(y_pred, 'values') else y_pred).reset_index(drop=True)
    sensitive_features = pd.Series(sensitive_features.values if hasattr(sensitive_features, 'values') else sensitive_features).reset_index(drop=True)
    
    # Selection rates for groups
    unique_groups = sensitive_features.unique()
    group_metrics = {}
    
    for group in unique_groups:
        mask = (sensitive_features == group)
        group_y_true = y_true[mask]
        group_y_pred = y_pred[mask]
        
        sel_rate = selection_rate(group_y_true, group_y_pred)
        tpr = true_positive_rate(group_y_true, group_y_pred)
        fpr = false_positive_rate(group_y_true, group_y_pred)
        
        # Use the group value as-is for the key (don't convert — strings like '0_1' must stay intact)
        group_metrics[group] = {
            'selection_rate':      float(sel_rate),
            'true_positive_rate':  float(tpr) if not np.isnan(tpr) else 0.0,
            'false_positive_rate': float(fpr) if not np.isnan(fpr) else 0.0,
            'count':               int(mask.sum()),
        }
        
    demographic_parity = demographic_parity_difference(y_true, y_pred, sensitive_features=sensitive_features)
    eq_odds = equalized_odds_difference(y_true, y_pred, sensitive_features=sensitive_features)
    
    # Calculate Equal Opportunity Difference (difference in TPR)
    tprs = [m['true_positive_rate'] for m in group_metrics.values()]
    equal_opportunity = max(tprs) - min(tprs) if len(tprs) > 1 else 0.0
    
    # Calculate Individual Fairness proxy (consistency score: fraction of nearest neighbors with same label)
    # Since individual fairness requires feature similarity, we can return a simplified score or represent it dynamically.
    
    return {
        'demographic_parity_difference': float(demographic_parity),
        'equalized_odds_difference': float(eq_odds),
        'equal_opportunity_difference': float(equal_opportunity),
        'group_metrics': group_metrics
    }

def audit_intersectional_fairness(y_true, y_pred, df, sensitive_cols):
    """
    Audit intersectional bias across combinations of sensitive attributes.
    """
    # Build intersectional feature BEFORE reset_index so keys stay as "0_1" etc.
    df_aligned = df[sensitive_cols].reset_index(drop=True)
    intersectional_features = df_aligned.astype(str).agg('_'.join, axis=1)
    metrics = compute_fairness_metrics(y_true, y_pred, intersectional_features)
    return metrics


def train_mitigated_model(model, X_train, y_train, sensitive_feature_name='funding_access'):
    """
    Train a mitigated model using Fairlearn's ThresholdOptimizer.
    """
    # Reset indices to ensure alignment
    X_train_r = X_train.reset_index(drop=True)
    y_train_r = pd.Series(y_train.values if hasattr(y_train, 'values') else y_train).reset_index(drop=True)
    sensitive_train = X_train_r[sensitive_feature_name]

    optimizer = ThresholdOptimizer(
        estimator=model,
        constraints="demographic_parity",
        predict_method="predict_proba"
    )
    optimizer.fit(X_train_r, y_train_r, sensitive_features=sensitive_train)

    os.makedirs('models', exist_ok=True)
    joblib.dump({"model": optimizer, "attr": sensitive_feature_name}, 'models/mitigated_threshold_opt.pkl')
    print("Mitigated model saved to models/mitigated_threshold_opt.pkl")
    return optimizer


def evaluate_mitigation_tradeoff(model, mitigated_model, X_test, y_test, sensitive_feature_name='funding_access'):
    """
    Evaluate accuracy and fairness metrics of baseline vs mitigated model.
    """
    # Reset indices to ensure alignment
    X_test_r = X_test.reset_index(drop=True)
    y_test_r = pd.Series(y_test.values if hasattr(y_test, 'values') else y_test).reset_index(drop=True)
    sensitive_test = X_test_r[sensitive_feature_name]

    y_pred_base = model.predict(X_test_r)
    acc_base    = accuracy_score(y_test_r, y_pred_base)
    f1_base     = f1_score(y_test_r, y_pred_base)
    metrics_base = compute_fairness_metrics(y_test_r, y_pred_base, sensitive_test)

    y_pred_mit = mitigated_model.predict(X_test_r, sensitive_features=sensitive_test)
    acc_mit    = accuracy_score(y_test_r, y_pred_mit)
    f1_mit     = f1_score(y_test_r, y_pred_mit)
    metrics_mit = compute_fairness_metrics(y_test_r, y_pred_mit, sensitive_test)

    return {
        'baseline': {
            'accuracy':                      float(acc_base),
            'f1_score':                      float(f1_base),
            'demographic_parity_difference': float(metrics_base['demographic_parity_difference']),
            'equalized_odds_difference':     float(metrics_base['equalized_odds_difference']),
            'equal_opportunity_difference':  float(metrics_base['equal_opportunity_difference']),
            'group_metrics':                 {str(k): {kk: float(vv) if isinstance(vv, (int, float)) else vv for kk, vv in v.items()} for k, v in metrics_base['group_metrics'].items()},
        },
        'mitigated': {
            'accuracy':                      float(acc_mit),
            'f1_score':                      float(f1_mit),
            'demographic_parity_difference': float(metrics_mit['demographic_parity_difference']),
            'equalized_odds_difference':     float(metrics_mit['equalized_odds_difference']),
            'equal_opportunity_difference':  float(metrics_mit['equal_opportunity_difference']),
            'group_metrics':                 {str(k): {kk: float(vv) if isinstance(vv, (int, float)) else vv for kk, vv in v.items()} for k, v in metrics_mit['group_metrics'].items()},
        }
    }
