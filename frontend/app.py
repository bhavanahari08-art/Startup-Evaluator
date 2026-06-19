import streamlit as st
import pandas as pd
import numpy as np
import os
import joblib
import plotly.express as px
import plotly.graph_objects as go
from sklearn.model_selection import train_test_split
from fairlearn.postprocessing import ThresholdOptimizer

# Add parent directory to path so backend functions can be imported
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.model_trainer import generate_synthetic_data
from backend.research_intel import search_semantic_scholar, get_genai_analysis
from backend.explainability import get_shap_explanations, get_dice_counterfactuals
from backend.bias_mitigator import (
    compute_fairness_metrics,
    audit_intersectional_fairness,
    train_mitigated_model,
    evaluate_mitigation_tradeoff
)

# Page Configuration
st.set_page_config(
    page_title="TrustEval - Explainable & Bias-Aware Startup Assessment",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling & Typography
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;500;700&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Plus Jakarta Sans', sans-serif;
    }
    
    .main-title {
        font-family: 'Outfit', sans-serif;
        font-weight: 800;
        background: linear-gradient(135deg, #FF6B6B 0%, #4D96FF 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 3rem;
        margin-bottom: 0.2rem;
    }
    
    .subtitle {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 1.2rem;
        color: #A0A0A0;
        margin-bottom: 2rem;
    }
    
    .glass-card {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 16px;
        padding: 24px;
        border: 1px solid rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        margin-bottom: 1.5rem;
    }
    
    .metric-value-high {
        font-size: 2.2rem;
        font-weight: 700;
        color: #00E676;
    }
    .metric-value-medium {
        font-size: 2.2rem;
        font-weight: 700;
        color: #FFD600;
    }
    .metric-value-low {
        font-size: 2.2rem;
        font-weight: 700;
        color: #FF1744;
    }
    
    /* Responsive custom tables */
    .styled-table {
        width: 100%;
        border-collapse: collapse;
        margin: 25px 0;
        font-size: 0.9em;
        min-width: 400px;
        border-radius: 8px 8px 0 0;
        overflow: hidden;
    }
    .styled-table th {
        background-color: #1E293B;
        color: #ffffff;
        text-align: left;
        font-weight: bold;
        padding: 12px 15px;
    }
    .styled-table td {
        padding: 12px 15px;
        border-bottom: 1px solid #334155;
    }
    </style>
""", unsafe_allow_html=True)

# Helper function to load dataset and model
@st.cache_resource
def load_assets():
    # If dataset doesn't exist, generate it
    if not os.path.exists('datasets/synthetic_startups.csv') or not os.path.exists('models/biased_rf_model.pkl'):
        # Generate and save models manually in case background runner hasn't finished
        from backend.model_trainer import train_and_save_models
        train_and_save_models()
        
    df = pd.read_csv('datasets/synthetic_startups.csv')
    model = joblib.load('models/biased_rf_model.pkl')
    return df, model

# Load Assets
try:
    df, model = load_assets()
    X = df.drop(columns=['feasibility_label'])
    y = df['feasibility_label']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
except Exception as e:
    st.error(f"Error loading assets: {e}")
    st.stop()

# Header Section
st.markdown('<h1 class="main-title">TrustEval</h1>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Explainable and Bias-Aware AI Framework for Startup Feasibility Assessment</div>', unsafe_allow_html=True)

# Sidebar - Founder Profile Input
st.sidebar.header("🛡️ Startup Evaluation Profile")

st.sidebar.subheader("Protected sensitive attributes")
founder_location = st.sidebar.selectbox("Founder Location", ["Rural", "Urban"], index=0)
education_level = st.sidebar.selectbox("Education Level", ["Tier 2/3 University/College", "Tier 1 University/College"], index=0)
funding_access = st.sidebar.selectbox("Funding / Capital Access", ["Low Capital Access", "High Capital Access"], index=0)
gender = st.sidebar.selectbox("Founder Gender Identification", ["Female", "Male"], index=0)

st.sidebar.subheader("Objective Technical/Market Metrics")
patent_novelty = st.sidebar.slider("Patent Novelty Score", 0, 100, 50)
research_support = st.sidebar.slider("Academic/Research Support", 0, 100, 45)
market_demand = st.sidebar.slider("Market Demand / Interest", 0, 100, 60)
competitor_density = st.sidebar.slider("Competitor Density / Saturation", 0, 100, 30)
team_experience = st.sidebar.slider("Founding Team Experience", 0, 100, 55)

# Convert string selections back to numerical representations for ML model
profile_data = {
    'founder_location': 1 if founder_location == "Urban" else 0,
    'education_level': 1 if "Tier 1" in education_level else 0,
    'funding_access': 1 if "High" in funding_access else 0,
    'gender': 1 if gender == "Male" else 0,
    'patent_novelty': float(patent_novelty),
    'research_support': float(research_support),
    'market_demand': float(market_demand),
    'competitor_density': float(competitor_density),
    'team_experience': float(team_experience)
}
user_input_df = pd.DataFrame([profile_data])

# Primary Tabs
tabs = st.tabs([
    "💡 Startup Feasibility Evaluation", 
    "🔬 Explainable AI Suite (XAI)", 
    "📊 Bias Audit & Fairness Mitigation",
    "📄 Trust Report Exporter"
])

# Global variables for cross-tab sharing
genai_analysis = None
papers_list = []

# --- TAB 1: Startup Feasibility Evaluation ---
with tabs[0]:
    col1, col2 = st.columns([3, 2])
    
    with col1:
        st.subheader("Submit Startup Pitch / Idea")
        startup_idea_text = st.text_area(
            "Describe the startup idea, technical approach, target audience, and business model:",
            value="An AI-powered agricultural tool that uses computer vision via edge devices to detect crop diseases early and works without internet connectivity, serving rural farmers.",
            height=120
        )
        
        evaluate_btn = st.button("🚀 Evaluate Startup Idea", use_container_width=True)
        
    with col2:
        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
        st.subheader("Model Assessment")
        
        # Make model prediction
        prob = model.predict_proba(user_input_df)[0][1]
        prediction = model.predict(user_input_df)[0]
        
        if prediction == 1:
            potential = "High Potential"
            css_class = "metric-value-high"
        else:
            if prob > 0.35:
                potential = "Medium Potential"
                css_class = "metric-value-medium"
            else:
                potential = "Low Potential"
                css_class = "metric-value-low"
                
        st.markdown(f"Feasibility Score: **{prob*100:.1f}%**")
        st.markdown(f'Assessed Level: <span class="{css_class}">{potential}</span>', unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)

    if evaluate_btn or 'genai_analysis_data' not in st.session_state:
        if evaluate_btn:
            with st.spinner("Searching academic databases and synthesizing insights..."):
                # Search papers
                papers = search_semantic_scholar(startup_idea_text, limit=4)
                # GenAI synthesis
                analysis = get_genai_analysis(startup_idea_text, papers)
                
                st.session_state['papers'] = papers
                st.session_state['genai_analysis_data'] = analysis
        else:
            # Load default cached or run initial run silently
            papers = search_semantic_scholar("edge computer vision crop disease rural farmers", limit=4)
            analysis = get_genai_analysis("AI crop disease detection for rural farmers", papers)
            st.session_state['papers'] = papers
            st.session_state['genai_analysis_data'] = analysis
            
    # Display research insights
    if 'genai_analysis_data' in st.session_state:
        analysis = st.session_state['genai_analysis_data']
        papers = st.session_state['papers']
        
        st.markdown("---")
        st.subheader("📝 AI Contextual Understanding & Summarization")
        
        c1, c2 = st.columns(2)
        with c1:
            st.markdown(f"**Domain Classification:** `{analysis.get('domain_classification', 'N/A')}`")
            st.write(f"**AI Interpretation:** {analysis.get('what_ai_understood', 'N/A')}")
        with c2:
            st.write(f"**Executive Summary:** *{analysis.get('startup_summary', 'N/A')}*")
            st.write(f"**Keywords:** {', '.join(analysis.get('keywords', []))}")
            
        st.markdown("---")
        st.subheader("🔬 Research Intelligence & Gap Discovery")
        
        col_r1, col_r2 = st.columns(2)
        with col_r1:
            st.markdown(f"**Research Saturation Status:** `{analysis.get('research_saturation', 'N/A')}`")
            st.write("**Identified Gaps in Literature:**")
            for gap in analysis.get('research_gaps', []):
                st.write(f"- {gap}")
        with col_r2:
            st.write("**Opportunities for Innovation:**")
            for opp in analysis.get('innovation_opportunities', []):
                st.write(f"- {opp}")
                
        st.subheader("📚 Related Literature Found (Semantic Scholar)")
        if papers:
            for p in papers:
                title = p.get('title', 'N/A')
                year = p.get('year', 'N/A')
                url = p.get('url', '#')
                cit = p.get('citationCount', 0)
                st.markdown(f"- **[{title}]({url})** ({year}) — Citations: {cit}")
        else:
            st.write("*No papers found in active database search. Fallback context triggered.*")
            
        st.markdown("---")
        st.subheader("⚙️ Feasibility Rationale & Risk Analysis")
        
        col_f1, col_f2 = st.columns(2)
        with col_f1:
            st.write("**Technical Feasibility:**")
            st.write(analysis.get('technical_feasibility', 'N/A'))
            st.write("**Market Feasibility:**")
            st.write(analysis.get('market_feasibility', 'N/A'))
            st.write("**Business Feasibility:**")
            st.write(analysis.get('business_feasibility', 'N/A'))
        with col_f2:
            st.write("**Primary Risks:**")
            for risk in analysis.get('risks', []):
                st.write(f"- {risk}")
            st.write("**Potential Failure Modes:**")
            for reason in analysis.get('failure_reasons', []):
                st.write(f"- {reason}")
                
        st.markdown("---")
        st.subheader("🛠️ Implementation Planning")
        col_i1, col_i2, col_i3 = st.columns(3)
        with col_i1:
            st.metric("Estimated Timeline", f"{analysis.get('development_time_months', 0)} Months")
        with col_i2:
            st.metric("Target Budget (INR)", f"₹{analysis.get('budget_inr', 0):,}")
        with col_i3:
            st.write("**Required Team Roles:**")
            for role in analysis.get('team_roles', []):
                st.write(f"- {role}")


# --- TAB 2: Explainable AI Suite (XAI) ---
with tabs[1]:
    st.subheader("Explainable AI (XAI) Dashboard")
    st.markdown("Transparently audit model prediction scores using global cohort trends, local contribution factors, and counterfactual scenario analysis.")
    
    # Run SHAP explanations
    with st.spinner("Generating SHAP feature attributions..."):
        global_df, local_df = get_shap_explanations(model, user_input_df, X_train)
        
    x_col1, x_col2 = st.columns(2)
    
    with x_col1:
        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
        st.subheader("🌐 Global Explanations: Feature Importance")
        st.markdown("Shows which parameters are generally the most influential across all historical startup evaluations.")
        
        # Color coding features (sensitive in Red/Orange, technical in Blue)
        sensitive_cols = ['founder_location', 'education_level', 'funding_access', 'gender']
        global_df['Type'] = global_df['Feature'].apply(lambda x: 'Protected (Sensitive)' if x in sensitive_cols else 'Technical / Market')
        
        fig_global = px.bar(
            global_df,
            x='Importance',
            y='Feature',
            orientation='h',
            color='Type',
            color_discrete_map={'Protected (Sensitive)': '#FF6B6B', 'Technical / Market': '#4D96FF'},
            title="Average Absolute SHAP Impact"
        )
        fig_global.update_layout(yaxis={'categoryorder':'total ascending'}, height=350)
        st.plotly_chart(fig_global, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)
        
    with x_col2:
        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
        st.subheader("📍 Local Explanations: Feature Attribution")
        st.markdown(f"Attributions showing exactly why **your specific startup idea** received its feasibility score.")
        
        # Map values to contributions
        local_df['Type'] = local_df['Feature'].apply(lambda x: 'Protected (Sensitive)' if x in sensitive_cols else 'Technical / Market')
        
        fig_local = px.bar(
            local_df,
            x='Contribution',
            y='Feature',
            orientation='h',
            color='Type',
            color_discrete_map={'Protected (Sensitive)': '#FF6B6B', 'Technical / Market': '#4D96FF'},
            title="SHAP Value Contribution to Decision"
        )
        fig_local.update_layout(yaxis={'categoryorder':'total ascending'}, height=350)
        st.plotly_chart(fig_local, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)
        
    st.markdown("---")
    st.subheader("🔄 Counterfactual Explanations (What-If Analysis)")
    st.markdown("Counterfactuals show the minimum changes necessary to continuous technical/market features to flip the feasibility assessment decision.")
    
    # Generate Counterfactuals
    with st.spinner("Generating DiCE counterfactual profiles..."):
        cf_df = get_dice_counterfactuals(model, user_input_df, X_train, y_train)
        
    if cf_df is not None:
        # Style and format the counterfactual table
        display_cf = cf_df.copy()
        
        # Apply labels
        display_cf['founder_location'] = display_cf['founder_location'].apply(lambda x: "Urban" if x == 1 else "Rural")
        display_cf['education_level'] = display_cf['education_level'].apply(lambda x: "Tier 1" if x == 1 else "Tier 2/3")
        display_cf['funding_access'] = display_cf['funding_access'].apply(lambda x: "High" if x == 1 else "Low")
        display_cf['gender'] = display_cf['gender'].apply(lambda x: "Male" if x == 1 else "Female")
        
        # Highlight modified metrics compared to inputs
        st.dataframe(display_cf, use_container_width=True)
        
        # Custom suggestion tips
        st.info("💡 **TrustEval Counterfactual Recommendations:** To achieve the alternate classification, focus on improving the attributes that shifted in the table above.")


# --- TAB 3: Bias Audit & Fairness Mitigation ---
with tabs[2]:
    st.subheader("Bias Auditing & Fairness Mitigation Engine")
    st.markdown("Evaluate whether the baseline machine learning model makes unfair decisions based on sensitive attributes, and run mitigation strategies.")
    
    # User selects which sensitive attribute to audit
    audit_attr = st.selectbox("Select sensitive attribute to audit and mitigate:", ['gender', 'founder_location', 'education_level', 'funding_access'])
    
    # Baseline predictions on test set
    y_pred_test = model.predict(X_test)
    
    # Audit metrics
    base_audit = compute_fairness_metrics(y_test, y_pred_test, X_test[audit_attr])
    
    aud_col1, aud_col2 = st.columns(2)
    
    with aud_col1:
        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
        st.subheader("⚖️ Fairness Metrics Summary")
        
        st.metric(
            label="Demographic Parity Difference",
            value=f"{base_audit['demographic_parity_difference']:.4f}",
            delta="Ideal: 0.0000",
            delta_color="off"
        )
        st.metric(
            label="Equal Opportunity Difference (TPR Difference)",
            value=f"{base_audit['equal_opportunity_difference']:.4f}",
            delta="Ideal: 0.0000",
            delta_color="off"
        )
        st.metric(
            label="Equalized Odds Difference",
            value=f"{base_audit['equalized_odds_difference']:.4f}",
            delta="Ideal: 0.0000",
            delta_color="off"
        )
        st.markdown("</div>", unsafe_allow_html=True)
        
    with aud_col2:
        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
        st.subheader("📍 Group Selection Rates")
        
        # Plot selection rates
        g_metrics = base_audit['group_metrics']
        labels = []
        sel_rates = []
        tprs = []
        
        for g, val in g_metrics.items():
            if audit_attr == 'gender':
                name = "Male" if g == 1 else "Female"
            elif audit_attr == 'founder_location':
                name = "Urban" if g == 1 else "Rural"
            elif audit_attr == 'education_level':
                name = "Tier 1" if g == 1 else "Tier 2/3"
            else: # funding_access
                name = "High Access" if g == 1 else "Low Access"
                
            labels.append(name)
            sel_rates.append(val['selection_rate'] * 100)
            tprs.append(val['true_positive_rate'] * 100)
            
        fig_rates = go.Figure(data=[
            go.Bar(name='Selection Rate (Positive prediction %)', x=labels, y=sel_rates, marker_color='#4D96FF'),
            go.Bar(name='True Positive Rate (Equal Opportunity)', x=labels, y=tprs, marker_color='#00E676')
        ])
        fig_rates.update_layout(barmode='group', height=280)
        st.plotly_chart(fig_rates, use_container_width=True)
        st.markdown("</div>", unsafe_allow_html=True)
        
    # Intersectional Bias Analysis
    st.markdown("---")
    st.subheader("🔗 Intersectional Fairness Audit")
    st.markdown("Evaluates hidden compound bias affecting combinations of multiple attributes (e.g. Rural + Low Funding access).")
    
    intersectional_cols = ['founder_location', 'funding_access']
    intersection_audit = audit_intersectional_fairness(y_test, y_pred_test, X_test, intersectional_cols)
    
    int_labels = []
    int_rates = []
    for g, val in intersection_audit['group_metrics'].items():
        # Decipher key '0_0' or '1_1'
        parts = str(g).split('_')
        loc = "Urban" if parts[0] == '1' else "Rural"
        fund = "High Fund" if parts[1] == '1' else "Low Fund"
        int_labels.append(f"{loc} + {fund}")
        int_rates.append(val['selection_rate'] * 100)
        
    fig_int = px.bar(
        x=int_rates,
        y=int_labels,
        orientation='h',
        labels={'x': 'Selection Rate (%)', 'y': 'Intersectional Group'},
        title="Selection Rates across Intersection of Location & Funding Access",
        color=int_rates,
        color_continuous_scale=px.colors.sequential.Bluered
    )
    st.plotly_chart(fig_int, use_container_width=True)
    
    # Mitigation Section
    st.markdown("---")
    st.subheader("🛠️ Mitigate Algorithmic Bias")
    st.markdown("Deploy Fairlearn's `ThresholdOptimizer` to correct demographic parity differences and generate a fairer model partition.")
    
    mitigate_btn = st.button("⚖️ Run Fairlearn Mitigation", use_container_width=True)
    
    if mitigate_btn:
        with st.spinner("Training ThresholdOptimizer to balance positive rates..."):
            # Fit mitigated model
            mit_opt = train_mitigated_model(model, X_train, y_train, sensitive_feature_name=audit_attr)
            
            # Compare performance
            comparison = evaluate_mitigation_tradeoff(model, mit_opt, X_test, y_test, sensitive_feature_name=audit_attr)
            
            # Store comparison in session state
            st.session_state['mitigation_comparison'] = comparison
            st.session_state['mitigated_model_loaded'] = mit_opt
            
    if 'mitigation_comparison' in st.session_state:
        comp = st.session_state['mitigation_comparison']
        
        st.success("Mitigation completed successfully!")
        
        comp_col1, comp_col2 = st.columns(2)
        
        with comp_col1:
            st.markdown("#### Model Performance Metrics")
            perf_df = pd.DataFrame({
                'Metric': ['Accuracy', 'F1 Score'],
                'Baseline Model': [comp['baseline']['accuracy'], comp['baseline']['f1_score']],
                'Mitigated Model': [comp['mitigated']['accuracy'], comp['mitigated']['f1_score']]
            })
            st.dataframe(perf_df, use_container_width=True)
            
            # Plot performance comparison
            fig_perf = go.Figure(data=[
                go.Bar(name='Baseline Model', x=perf_df['Metric'], y=perf_df['Baseline Model']*100, marker_color='#FF6B6B'),
                go.Bar(name='Mitigated Model', x=perf_df['Metric'], y=perf_df['Mitigated Model']*100, marker_color='#4D96FF')
            ])
            fig_perf.update_layout(yaxis_title="Percentage (%)", height=250)
            st.plotly_chart(fig_perf, use_container_width=True)
            
        with comp_col2:
            st.markdown("#### Algorithmic Fairness Metrics")
            fair_df = pd.DataFrame({
                'Fairness Metric': ['Demographic Parity Diff', 'Equal Opportunity Diff', 'Equalized Odds Diff'],
                'Baseline Model': [
                    comp['baseline']['demographic_parity_difference'], 
                    comp['baseline']['equal_opportunity_difference'],
                    comp['baseline']['equalized_odds_difference']
                ],
                'Mitigated Model': [
                    comp['mitigated']['demographic_parity_difference'], 
                    comp['mitigated']['equal_opportunity_difference'],
                    comp['mitigated']['equalized_odds_difference']
                ]
            })
            st.dataframe(fair_df, use_container_width=True)
            
            # Plot fairness metrics comparison
            fig_fair = go.Figure(data=[
                go.Bar(name='Baseline Model', x=fair_df['Fairness Metric'], y=fair_df['Baseline Model'], marker_color='#FF6B6B'),
                go.Bar(name='Mitigated Model', x=fair_df['Fairness Metric'], y=fair_df['Mitigated Model'], marker_color='#4D96FF')
            ])
            fig_fair.update_layout(yaxis_title="Difference (Lower is better)", height=250)
            st.plotly_chart(fig_fair, use_container_width=True)
            
        st.info("💡 **Aesthetics & Performance Trade-off:** Note how the mitigated model significantly reduces bias metrics (closer to 0.0) with a marginal trade-off in baseline test accuracy.")


# --- TAB 4: Trust Report Exporter ---
with tabs[3]:
    st.subheader("📋 Complete Trust Report Exporter")
    st.markdown("Download a fully compiled, explainable, and audited feasibility report for the assessed startup idea.")
    
    # Check if GenAI data is ready
    if 'genai_analysis_data' in st.session_state:
        analysis = st.session_state['genai_analysis_data']
        prob = model.predict_proba(user_input_df)[0][1]
        prediction = model.predict(user_input_df)[0]
        
        # Build Report Markdown Content
        report_md = f"""# TRUSTEVAL SYSTEM REPORT
## Startup Feasibility Assessment Summary
- **Startup Name/Idea:** {startup_idea_text[:60]}...
- **Domain:** {analysis.get('domain_classification', 'N/A')}
- **Raw Feasibility Score:** {prob*100:.2f}%
- **Potential Class:** {"High Potential" if prediction == 1 else "Low/Medium Potential"}

---

## 1. Research Intelligence & Synthesis
- **Summary:** {analysis.get('startup_summary', 'N/A')}
- **Research Saturation:** {analysis.get('research_saturation', 'N/A')}
- **Innovation Opportunities:**
{chr(10).join([f"  - {opp}" for opp in analysis.get('innovation_opportunities', [])])}
- **Research Gaps:**
{chr(10).join([f"  - {gap}" for gap in analysis.get('research_gaps', [])])}

---

## 2. Explainable AI Insights
- **Top Attributing Feature (Local):** {local_df.iloc[0]['Feature']} (Contribution: {local_df.iloc[0]['Contribution']:.4f})
- **Top General Feature (Global):** {global_df.iloc[0]['Feature']} (Importance: {global_df.iloc[0]['Importance']:.4f})

---

## 3. Algorithmic Bias Audit Results
- **Audited Protected Attribute:** {audit_attr.upper()}
- **Baseline Demographic Parity Difference:** {base_audit['demographic_parity_difference']:.4f}
- **Baseline Equalized Odds Difference:** {base_audit['equalized_odds_difference']:.4f}

---

## 4. Implementation Requirements
- **Timeline:** {analysis.get('development_time_months', 0)} Months
- **Target Budget:** INR {analysis.get('budget_inr', 0):,}
- **Roles:** {', '.join(analysis.get('team_roles', []))}
"""
        st.text_area("Audit Log & MD Report Content", report_md, height=400)
        
        st.download_button(
            label="📥 Download Trust Report (.md)",
            data=report_md,
            file_name="trusteval_report.md",
            mime="text/markdown",
            use_container_width=True
        )
    else:
        st.warning("Please run the 'Evaluate Startup Idea' process under Tab 1 first to generate the necessary research and GenAI metrics.")
