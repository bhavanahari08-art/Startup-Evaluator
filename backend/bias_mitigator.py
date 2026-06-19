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
    # Convert inputs to pandas Series/DataFrames if they aren't already
    y_true = pd.Series(y_true)
    y_pred = pd.Series(y_pred)
    sensitive_features = pd.Series(sensitive_features)
    
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
        
        group_metrics[int(group)] = {
            'selection_rate': float(sel_rate),
            'true_positive_rate': float(tpr) if not np.isnan(tpr) else 0.0,
            'false_positive_rate': float(fpr) if not np.isnan(fpr) else 0.0,
            'count': int(mask.sum())
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
    # Create intersectional category
    intersectional_features = df[sensitive_cols].astype(str).agg('_'.join, axis=1)
    
    metrics = compute_fairness_metrics(y_true, y_pred, intersectional_features)
    return metrics

def train_mitigated_model(model, X_train, y_train, sensitive_feature_name='funding_access'):
    """
    Train a mitigated model using Fairlearn's ThresholdOptimizer.
    Mitigation targets the specified sensitive feature.
    """
    # Get sensitive features for training data
    sensitive_train = X_train[sensitive_feature_name]
    
    # Initialize ThresholdOptimizer with demographic parity or equalized odds
    optimizer = ThresholdOptimizer(
        estimator=model,
        constraints="demographic_parity",
        predict_method="predict_proba"
    )
    
    # Fit the optimizer
    optimizer.fit(X_train, y_train, sensitive_features=sensitive_train)
    
    # Save mitigated optimizer
    os.makedirs('models', exist_ok=True)
    joblib.dump(optimizer, 'models/mitigated_threshold_opt.pkl')
    print("Mitigated model saved to models/mitigated_threshold_opt.pkl")
    return optimizer

def evaluate_mitigation_tradeoff(model, mitigated_model, X_test, y_test, sensitive_feature_name='funding_access'):
    """
    Evaluate the accuracy and fairness metrics of baseline vs mitigated model on test data.
    """
    sensitive_test = X_test[sensitive_feature_name]
    
    # Predict with baseline
    y_pred_base = model.predict(X_test)
    acc_base = accuracy_score(y_test, y_pred_base)
    f1_base = f1_score(y_test, y_pred_base)
    metrics_base = compute_fairness_metrics(y_test, y_pred_base, sensitive_test)
    
    # Predict with mitigated
    y_pred_mit = mitigated_model.predict(X_test, sensitive_features=sensitive_test)
    acc_mit = accuracy_score(y_test, y_pred_mit)
    f1_mit = f1_score(y_test, y_pred_mit)
    metrics_mit = compute_fairness_metrics(y_test, y_pred_mit, sensitive_test)
    
    return {
        'baseline': {
            'accuracy': acc_base,
            'f1_score': f1_base,
            'demographic_parity_difference': metrics_base['demographic_parity_difference'],
            'equalized_odds_difference': metrics_base['equalized_odds_difference'],
            'equal_opportunity_difference': metrics_base['equal_opportunity_difference'],
            'group_metrics': metrics_base['group_metrics']
        },
        'mitigated': {
            'accuracy': acc_mit,
            'f1_score': f1_mit,
            'demographic_parity_difference': metrics_mit['demographic_parity_difference'],
            'equalized_odds_difference': metrics_mit['equalized_odds_difference'],
            'equal_opportunity_difference': metrics_mit['equal_opportunity_difference'],
            'group_metrics': metrics_mit['group_metrics']
        }
    }
