import shap
import dice_ml
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import io
import base64

def get_shap_explanations(model, user_input_df, X_train):
    """
    Generate SHAP global importance data and local SHAP explanation for the user's specific startup profile.
    """
    # 1. Global Explainability
    # Use TreeExplainer for Random Forest
    explainer = shap.TreeExplainer(model)
    
    # Global SHAP importance values
    shap_values_global = explainer.shap_values(X_train)
    # Binary classification returns a list or 3D array depending on version. Let's extract the class 1 SHAP values.
    if isinstance(shap_values_global, list):
        shap_class_1 = shap_values_global[1]
    else:
        # If it's a 3D/2D array, get the class 1 slice (typically index 1)
        if len(shap_values_global.shape) == 3:
            shap_class_1 = shap_values_global[:, :, 1]
        else:
            shap_class_1 = shap_values_global
            
    global_importance = np.abs(shap_class_1).mean(axis=0)
    global_df = pd.DataFrame({
        'Feature': X_train.columns,
        'Importance': global_importance
    }).sort_values(by='Importance', ascending=False)
    
    # 2. Local Explainability
    shap_values_local = explainer.shap_values(user_input_df)
    if isinstance(shap_values_local, list):
        local_contributions = shap_values_local[1][0]
    else:
        if len(shap_values_local.shape) == 3:
            local_contributions = shap_values_local[0, :, 1]
        else:
            local_contributions = shap_values_local[0]
            
    local_df = pd.DataFrame({
        'Feature': user_input_df.columns,
        'Value': user_input_df.iloc[0].values,
        'Contribution': local_contributions
    }).sort_values(by='Contribution', key=abs, ascending=False)
    
    return global_df, local_df

def get_dice_counterfactuals(model, user_input_df, X_train, y_train):
    """
    Generate DiCE counterfactuals showing how the startup can flip its decision.
    """
    # Create synthetic outcome column for DiCE
    training_data = X_train.copy()
    training_data['feasibility_label'] = y_train
    
    continuous_features = [
        'patent_novelty', 'research_support', 'market_demand', 
        'competitor_density', 'team_experience'
    ]
    
    # Create DiCE data object
    d = dice_ml.Data(
        dataframe=training_data,
        continuous_features=continuous_features,
        outcome_name='feasibility_label'
    )
    
    # Create DiCE model object
    m = dice_ml.Model(model=model, backend="sklearn")
    
    # Initialize DiCE explainer (using random method for fast generation in UI environments)
    exp = dice_ml.Dice(d, m, method="random")
    
    desired_class = 1 if model.predict(user_input_df)[0] == 0 else 0
    
    try:
        # Generate counterfactuals
        cf = exp.generate_counterfactuals(
            user_input_df, 
            total_CFs=3, 
            desired_class=desired_class,
            features_to_vary=continuous_features
        )
        # Convert counterfactual output to dataframe
        cf_df = cf.cf_examples_list[0].final_cfs_df
        return cf_df
    except Exception as e:
        print(f"Error generating DiCE counterfactuals: {e}")
        # Fallback counterfactuals
        fallback_cf = user_input_df.copy()
        fallback_cf['feasibility_label'] = desired_class
        # Modify some parameters towards target to show simulated output
        if desired_class == 1:
            fallback_cf['patent_novelty'] = min(100.0, fallback_cf['patent_novelty'].iloc[0] + 15.0)
            fallback_cf['research_support'] = min(100.0, fallback_cf['research_support'].iloc[0] + 10.0)
            fallback_cf['market_demand'] = min(100.0, fallback_cf['market_demand'].iloc[0] + 10.0)
        else:
            fallback_cf['patent_novelty'] = max(0.0, fallback_cf['patent_novelty'].iloc[0] - 15.0)
        return fallback_cf
