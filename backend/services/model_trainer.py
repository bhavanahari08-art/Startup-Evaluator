import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

def generate_synthetic_data(num_samples=1000, seed=42):
    np.random.seed(seed)
    
    # Sensitive attributes (Protected features)
    # 0: Rural, 1: Urban
    founder_location = np.random.choice([0, 1], size=num_samples, p=[0.4, 0.6])
    # 0: Tier 2/3, 1: Tier 1
    education_level = np.random.choice([0, 1], size=num_samples, p=[0.6, 0.4])
    # 0: Low, 1: High
    funding_access = np.random.choice([0, 1], size=num_samples, p=[0.7, 0.3])
    # 0: Female, 1: Male
    gender = np.random.choice([0, 1], size=num_samples, p=[0.3, 0.7])
    
    # Core technical/market features (0 to 100)
    patent_novelty = np.random.randint(20, 100, size=num_samples).astype(float)
    research_support = np.random.randint(10, 100, size=num_samples).astype(float)
    market_demand = np.random.randint(30, 100, size=num_samples).astype(float)
    competitor_density = np.random.randint(10, 100, size=num_samples).astype(float)
    team_experience = np.random.randint(20, 100, size=num_samples).astype(float)
    
    # Calculate feasibility score (Ground truth with intentional bias)
    # The true performance should ideally depend on patent_novelty, research_support, market_demand, team_experience
    # We subtract competitor_density.
    # We introduce systemic bias favoring: Urban (location=1), Tier 1 (education=1), High Funding (funding=1), Male (gender=1)
    base_score = (
        0.25 * patent_novelty + 
        0.20 * research_support + 
        0.25 * market_demand + 
        0.20 * team_experience - 
        0.15 * competitor_density
    )
    
    # Injecting intentional bias to simulate historical bias in startup funding/evaluation
    bias_score = (
        12.0 * founder_location + 
        10.0 * education_level + 
        15.0 * funding_access + 
        8.0 * gender
    )
    
    total_score = base_score + bias_score
    # Map to 0-1 scale and threshold to create binary labels
    # Normalize total score to roughly 0-100 range
    min_val, max_val = total_score.min(), total_score.max()
    normalized_score = 100.0 * (total_score - min_val) / (max_val - min_val)
    
    # Label is 1 if score > 50 else 0
    feasibility_label = (normalized_score >= 50).astype(int)
    
    df = pd.DataFrame({
        'founder_location': founder_location,
        'education_level': education_level,
        'funding_access': funding_access,
        'gender': gender,
        'patent_novelty': patent_novelty,
        'research_support': research_support,
        'market_demand': market_demand,
        'competitor_density': competitor_density,
        'team_experience': team_experience,
        'feasibility_label': feasibility_label
    })
    
    return df

def train_and_save_models():
    os.makedirs('datasets', exist_ok=True)
    os.makedirs('models', exist_ok=True)
    
    df = generate_synthetic_data(num_samples=1500)
    df.to_csv('datasets/synthetic_startups.csv', index=False)
    print("Synthetic dataset saved to datasets/synthetic_startups.csv")
    
    # Split features and target
    X = df.drop(columns=['feasibility_label'])
    y = df['feasibility_label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train primary estimator (biased RandomForestClassifier)
    model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate model
    accuracy = model.score(X_test, y_test)
    print(f"Baseline Model Accuracy: {accuracy:.4f}")
    
    # Save the model
    joblib.dump(model, 'models/biased_rf_model.pkl')
    print("Model saved to models/biased_rf_model.pkl")

if __name__ == '__main__':
    train_and_save_models()
