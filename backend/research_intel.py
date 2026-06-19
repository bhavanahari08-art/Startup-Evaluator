import requests
import os
import json

def search_semantic_scholar(query, limit=5):
    """
    Search research papers using the Semantic Scholar API.
    """
    url = (
        f"https://api.semanticscholar.org/graph/v1/paper/search"
        f"?query={requests.utils.quote(query)}&limit={limit}"
        f"&fields=title,abstract,url,year,citationCount"
    )
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            return data.get("data", [])
    except Exception as e:
        print(f"Error querying Semantic Scholar: {e}")
    return []

def get_genai_analysis(idea, papers):
    """
    Query Google Generative AI to understand the startup idea, extract domains,
    summarize, identify gaps/saturation level, perform feasibility scoring rationale,
    and estimate resources.
    Falls back to a rule-based response if no API key is set.
    """
    papers_context = ""
    for idx, p in enumerate(papers):
        title = p.get('title', 'N/A')
        abstract = p.get('abstract', 'N/A') or 'N/A'
        papers_context += f"Paper {idx+1}:\nTitle: {title}\nAbstract: {abstract}\n\n"

    prompt = f"""
You are the primary cognitive engine for TrustEval, a research-grade explainable and bias-aware startup feasibility framework.
Analyze the following startup idea: "{idea}"

We searched academic literature on Semantic Scholar and found these papers:
{papers_context}

Output ONLY a raw JSON object (no markdown, no backticks) with these exact keys:
{{
  "what_ai_understood": "...",
  "startup_summary": "...",
  "domain_classification": "...",
  "keywords": ["...", "..."],
  "research_saturation": "Research area already saturated OR Opportunity exists",
  "research_gaps": ["...", "..."],
  "innovation_opportunities": ["...", "..."],
  "missing_capabilities": ["...", "..."],
  "new_key_features": ["...", "..."],
  "technical_feasibility": "...",
  "market_feasibility": "...",
  "business_feasibility": "...",
  "advantages": ["...", "..."],
  "disadvantages": ["...", "..."],
  "risks": ["...", "..."],
  "failure_reasons": ["...", "..."],
  "team_roles": ["...", "..."],
  "development_time_months": 4,
  "budget_inr": 300000
}}
"""

    # Try new google-genai SDK first
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            from google import genai as genai_new
            client = genai_new.Client(api_key=api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            text = response.text.strip()
            # Strip any accidental markdown fences
            if text.startswith("```"):
                lines = text.splitlines()
                start = 1 if lines[0].startswith("```") else 0
                end = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
                text = "\n".join(lines[start:end])
            return json.loads(text)
        except Exception as e:
            print(f"google-genai SDK call failed: {e}")

    # Fallback: rule-based intelligent response
    print("Running in offline/fallback mode — no Gemini API key found.")
    is_saturated = "Research area already saturated" if len(papers) > 3 else "Opportunity exists"
    return {
        "what_ai_understood": (
            f"The proposed idea revolves around: {idea}. "
            "It aims to solve an industry-specific problem using modern technology."
        ),
        "startup_summary": f"An innovative venture targeting solution deployment for: {idea[:80]}",
        "domain_classification": "Cross-domain AI / Tech Venture",
        "keywords": ["Innovation", "Automation", "Efficiency"],
        "research_saturation": is_saturated,
        "research_gaps": [
            "Lack of real-time low-latency performance optimization studies",
            "Limited benchmark datasets for domain-specific edge-cases"
        ],
        "innovation_opportunities": [
            "Integration of edge deployment models",
            "Explainability workflows built into the core stack"
        ],
        "missing_capabilities": [
            "High dependency on cloud networks",
            "Initial model latency constraints"
        ],
        "new_key_features": [
            "Offline/Edge computing capability",
            "Automated feedback loop mechanisms"
        ],
        "technical_feasibility": "High feasibility with standard models, but edge constraints exist.",
        "market_feasibility": "Moderate feasibility. High user demand, competitive landscape is active.",
        "business_feasibility": "Viable model with SaaS subscription or B2B enterprise licensing.",
        "advantages": ["Automated operations", "Low manual error margin"],
        "disadvantages": ["High initial data acquisition cost", "Domain expert requirement"],
        "risks": ["Algorithm bias risk", "System integration downtime"],
        "failure_reasons": ["Poor product-market fit alignment", "Data security compliance issues"],
        "team_roles": ["2 AI Engineers", "1 Full Stack Developer", "1 Domain Expert"],
        "development_time_months": 5,
        "budget_inr": 450000
    }
