import requests
import os
import json
import time

# ── Paper Search ─────────────────────────────────────────────────────────────

def search_semantic_scholar(query, limit=10):
    """Search Semantic Scholar with retry + backoff. Falls back to OpenAlex."""
    url = (
        f"https://api.semanticscholar.org/graph/v1/paper/search"
        f"?query={requests.utils.quote(query)}&limit={limit}"
        f"&fields=title,abstract,url,year,citationCount,authors,externalIds,openAccessPdf"
    )
    headers = {
        "User-Agent": "TrustEval-Research/1.0 (research tool; contact: trusteval@example.com)"
    }
    for attempt in range(3):
        try:
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                if data:
                    return data
            elif resp.status_code == 429:
                wait = 2 ** attempt
                print(f"Semantic Scholar rate limited. Waiting {wait}s...")
                time.sleep(wait)
            else:
                break
        except Exception as e:
            print(f"Semantic Scholar error: {e}")
            break
    return search_openalex(query, limit=limit)


def search_openalex(query, limit=10):
    """OpenAlex — free, no auth, 200M+ papers."""
    url = (
        f"https://api.openalex.org/works"
        f"?search={requests.utils.quote(query)}"
        f"&per-page={limit}"
        f"&select=title,abstract_inverted_index,publication_year,cited_by_count,"
        f"authorships,doi,open_access,primary_location"
        f"&mailto=trusteval@example.com"
    )
    try:
        resp = requests.get(url, timeout=12)
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            papers = []
            for r in results:
                inv      = r.get("abstract_inverted_index") or {}
                abstract = _reconstruct_abstract(inv)
                authors  = [
                    {"name": a["author"]["display_name"]}
                    for a in (r.get("authorships") or [])[:5]
                    if a.get("author")
                ]
                doi     = r.get("doi") or ""
                url_str = doi if doi.startswith("http") else (
                    f"https://doi.org/{doi}" if doi else
                    (r.get("primary_location") or {}).get("landing_page_url") or ""
                )
                oa      = r.get("open_access") or {}
                pdf_url = oa.get("oa_url") or ""
                papers.append({
                    "title":         r.get("title") or "Untitled",
                    "abstract":      abstract,
                    "year":          r.get("publication_year"),
                    "citationCount": r.get("cited_by_count", 0),
                    "url":           url_str,
                    "authors":       authors,
                    "externalIds":   {"DOI": doi.replace("https://doi.org/", "")} if doi else {},
                    "openAccessPdf": {"url": pdf_url} if pdf_url else {},
                    "source":        "OpenAlex",
                })
            return papers
    except Exception as e:
        print(f"OpenAlex error: {e}")
    return []


def _reconstruct_abstract(inverted_index: dict) -> str:
    if not inverted_index:
        return ""
    positions = {}
    for word, pos_list in inverted_index.items():
        for pos in pos_list:
            positions[pos] = word
    if not positions:
        return ""
    return " ".join(positions[i] for i in sorted(positions.keys()))[:600]


def _extract_patent_keywords(idea: str) -> str:
    """
    Extract 3-5 short technical keywords from an idea for patent search URLs.
    Uses Gemini if available, otherwise uses a smart noun-extraction heuristic.
    Patent search URLs break with long sentences — must be concise keywords only.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            if api_key.startswith("sk-or-"):
                import requests
                resp = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": "google/gemini-2.0-flash-001", "messages": [{"role": "user", "content": (
                        f'Extract exactly 3-5 short technical patent search keywords from this idea. '
                        f'Return ONLY the keywords separated by spaces, no punctuation, no brackets, no explanation. '
                        f'Focus on the core technology/domain words. '
                        f'Example input: "AI crop disease detector for farmers using smartphone photos"\n'
                        f'Example output: crop disease detection AI smartphone\n\n'
                        f'Input: {idea[:300]}'
                    )}]})
                kw = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip().replace('"', '').replace("'", '').replace('(', '').replace(')', '').strip()
            else:
                from google import genai as genai_new
                client = genai_new.Client(api_key=api_key)
                resp = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=(
                        f'Extract exactly 3-5 short technical patent search keywords from this idea. '
                        f'Return ONLY the keywords separated by spaces, no punctuation, no brackets, no explanation. '
                        f'Focus on the core technology/domain words. '
                        f'Example input: "AI crop disease detector for farmers using smartphone photos"\n'
                        f'Example output: crop disease detection AI smartphone\n\n'
                        f'Input: {idea[:300]}'
                    )
                )
                kw = resp.text.strip().replace('"', '').replace("'", '').replace('(', '').replace(')', '').strip()
            kw = resp.text.strip().replace('"', '').replace("'", '').replace('(', '').replace(')', '').strip()
            # Only accept if it's short enough to be keywords (not a sentence)
            if kw and len(kw) < 80 and '\n' not in kw:
                return kw
        except Exception:
            pass

    # Smart heuristic: pick technical / domain nouns, skip common words
    stopwords = {
        'with','that','this','from','using','based','which','through','their',
        'about','have','will','would','could','should','into',
        'help','want','need','make','build','create','develop',
        'provide','allow','enable','support','manage','improve',
        'user','users','people','person','someone','anyone',
        'thing','things','information','process','feature','features',
    }
    # Technical domain words get priority
    domain_words = {
        'ai','ml','iot','blockchain','ar','vr','api','saas','nlp','llm',
        'deep','neural','model','sensor','robot','drone','health','medical',
        'finance','fintech','edtech','agri','cyber','cloud','edge','mobile',
        'crypto','web3','vision','speech','image','video','detection','recognition',
        'prediction','analysis','automation','optimization','tracking','monitoring',
    }
    words = []
    for w in idea.replace('/', ' ').replace('-', ' ').split():
        w_clean = w.strip('.,;:()[]!?"\'-').lower()
        if not w_clean or len(w_clean) < 3:
            continue
        if w_clean in domain_words:
            words.insert(0, w_clean)  # prioritize domain words
        elif w_clean not in stopwords and len(w_clean) >= 4:
            words.append(w_clean)

    # Keep best 4, deduplicate — prioritize domain/technical words, cap at 4
    seen = set()
    result = []
    for w in words:
        if w not in seen:
            seen.add(w)
            result.append(w)
        if len(result) >= 4:
            break

    return ' '.join(result) if result else ' '.join(idea.split()[:3])


def _build_patent_links(query, limit=5):
    """Build patent search links using SHORT keywords, not the full idea text."""
    keywords = _extract_patent_keywords(query)
    encoded = requests.utils.quote(keywords)
    return [
        {
            "source": "Google Patents",
            "title": f'Search: "{keywords}" on Google Patents',
            "url": f"https://patents.google.com/?q={encoded}&num={limit}",
            "description": "Comprehensive patent database covering USPTO, EPO, WIPO and 100+ patent offices worldwide.",
            "type": "patent_search",
            "jurisdiction": "Global",
        },
        {
            "source": "WIPO PatentScope",
            "title": f'Search: "{keywords}" on WIPO PatentScope',
            "url": f"https://patentscope.wipo.int/search/en/search.jsf?query={encoded}",
            "description": "WIPO's international patent database covering PCT applications and national collections.",
            "type": "patent_search",
            "jurisdiction": "International (PCT)",
        },
        {
            "source": "EPO Espacenet",
            "title": f'Search: "{keywords}" on EPO Espacenet',
            "url": f"https://worldwide.espacenet.com/patent/search?q={encoded}",
            "description": "European Patent Office database with 120+ million patent documents worldwide.",
            "type": "patent_search",
            "jurisdiction": "Europe + Global",
        },
        {
            "source": "USPTO Patent Search",
            "title": f'Search: "{keywords}" on USPTO',
            "url": f"https://ppubs.uspto.gov/pubwebapp/external.html#/search?query={encoded}&searchType=1",
            "description": "United States Patent and Trademark Office — full-text patent search across all US patents.",
            "type": "patent_search",
            "jurisdiction": "USA",
        },
        {
            "source": "Indian Patent Office",
            "title": f'Search: "{keywords}" on IP India',
            "url": f"https://ipindiaservices.gov.in/publicsearch",
            "description": "Controller General of Patents, Designs & Trade Marks — India patent search portal.",
            "type": "patent_search",
            "jurisdiction": "India",
        },
    ]


def search_all_research(query: str, paper_limit: int = 10):
    papers  = search_semantic_scholar(query, limit=paper_limit)
    patents = _build_patent_links(query)
    return {"papers": papers, "patents": patents}


# ── Research Chat ─────────────────────────────────────────────────────────────

def get_research_chat_response(user_message: str, conversation_history: list,
                               papers: list, patents: list) -> str:
    papers_ctx = ""
    for i, p in enumerate(papers[:8]):
        title    = p.get('title', 'N/A')
        abstract = (p.get('abstract') or '')[:300]
        year     = p.get('year', 'N/A')
        url      = p.get('url', '')
        authors  = ", ".join([a.get('name', '') for a in (p.get('authors') or [])[:3]])
        cit      = p.get('citationCount', 0)
        papers_ctx += f"\nPaper {i+1}: \"{title}\" ({year})\n"
        papers_ctx += f"  Authors: {authors}\n"
        papers_ctx += f"  Citations: {cit} | URL: {url}\n"
        papers_ctx += f"  Abstract: {abstract}...\n"

    patents_ctx = "\nPatent Databases Searched:\n"
    for pat in patents:
        patents_ctx += f"- {pat['source']} ({pat['jurisdiction']}): {pat['url']}\n"

    history_ctx = ""
    for msg in conversation_history[-6:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        history_ctx += f"{role}: {msg['content']}\n"

    prompt = f"""You are TrustEval's Research Intelligence Assistant — a knowledgeable AI that helps researchers and entrepreneurs understand the academic and patent landscape around their ideas.

CONVERSATION HISTORY:
{history_ctx}

USER'S CURRENT MESSAGE: {user_message}

RESEARCH CONTEXT — Papers found:
{papers_ctx}

PATENT CONTEXT:
{patents_ctx}

INSTRUCTIONS:
- Respond in a conversational, helpful tone like a smart research advisor
- Directly answer the user's question using the papers and patents found
- Cite specific paper titles and years when relevant (use **bold** for titles)
- Mention key authors and citation counts to indicate paper importance
- Identify research gaps, trends, and opportunities visible in the literature
- For patents: guide the user to the specific patent databases with direct links
- If papers are from diverse years, comment on how the field has evolved
- Keep responses focused but thorough — 3 to 6 paragraphs typically
- Use markdown formatting: **bold**, bullet lists, and headers where helpful
- End with 1-2 follow-up questions to deepen the research conversation
"""

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            if api_key.startswith("sk-or-"):
                import requests
                resp = requests.post("https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": "google/gemini-2.0-flash-001", "messages": [{"role": "user", "content": prompt}]})
                return resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            else:
                from google import genai as genai_new
                client = genai_new.Client(api_key=api_key)
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
                return response.text.strip()
        except Exception as e:
            print(f"Gemini chat error: {e}")

    return _offline_chat_response(user_message, papers, patents)


def _offline_chat_response(query: str, papers: list, patents: list) -> str:
    if not papers:
        return (
            f"I searched for **\"{query}\"** but found no matching papers right now.\n\n"
            "**Patent Databases to explore:**\n" +
            "\n".join([f"- [{p['source']}]({p['url']}) — {p['jurisdiction']}" for p in patents]) +
            "\n\n*Connect a Gemini API key for full AI-powered analysis.*"
        )
    top = papers[:3]
    years = [p.get('year') for p in papers if p.get('year')]
    year_range = f"{min(years)}–{max(years)}" if years else "various years"
    response = f"I found **{len(papers)} research papers** related to **\"{query}\"** spanning {year_range}.\n\n"
    response += "**Top papers:**\n"
    for p in top:
        response += f"- **[{p.get('title','Unknown')}]({p.get('url','#')})** ({p.get('year','N/A')}) — {p.get('citationCount',0)} citations\n"
    response += "\n**Patent Databases:**\n"
    for pat in patents[:3]:
        response += f"- [{pat['source']}]({pat['url']}) — {pat['jurisdiction']}\n"
    response += "\n\n*Add a Gemini API key for deeper AI analysis.*"
    response += "\n\n**Follow-up:** Would you like to focus on a specific sub-topic or explore the patent landscape?"
    return response


# ── Startup Feasibility Analysis ─────────────────────────────────────────────

def get_genai_analysis(idea: str, papers: list) -> dict:
    """
    Analyse a startup idea with Gemini AI.
    Returns full analysis including AI-estimated technical metric scores (0–100).
    Falls back to rule-based if no API key.
    """
    papers_context = ""
    for idx, p in enumerate(papers):
        title    = p.get('title', 'N/A')
        abstract = (p.get('abstract') or 'N/A')[:400]
        papers_context += f"Paper {idx+1}:\nTitle: {title}\nAbstract: {abstract}\n\n"

    prompt = f"""You are TrustEval's primary AI engine for startup feasibility analysis.
Analyze this startup idea: "{idea}"

Academic papers found:
{papers_context}

Return ONLY a valid raw JSON object (no markdown, no code fences) with EXACTLY these keys.
For the five numeric scores estimate based on the idea's real characteristics (integers 0-100):
- patent_novelty_score: uniqueness/novelty of IP (0=fully existing, 100=completely novel)
- research_support_score: strength of academic backing (0=no research, 100=deep research base)
- market_demand_score: validated market demand (0=no demand, 100=very high demand)
- competitor_density_score: competition level (0=no competitors, 100=extremely crowded)
- team_experience_score: expertise level needed (0=anyone can build it, 100=deep specialist team)

For idea_novelty_status, use EXACTLY one of:
- "Already Exists" — if this idea is well-known and widely deployed
- "Partially Exists" — if similar solutions exist but this specific combination is not fully explored
- "Novel" — if this is a genuinely new idea with little to no existing implementation

{{
  "what_ai_understood": "2-3 sentence explanation of what the AI understood from the input",
  "startup_summary": "1 paragraph executive summary of the startup",
  "domain_classification": "Primary domain e.g. AgriTech, HealthTech, FinTech, EdTech, Cybersecurity, AI/ML, etc.",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "idea_novelty_status": "Already Exists OR Partially Exists OR Novel",
  "existing_solutions": ["List of existing similar products/solutions if idea already exists or partially exists"],
  "what_currently_exists": "Explanation of what currently exists in this space",
  "suggested_new_features": ["Feature 1 to make it unique", "Feature 2", "Feature 3"],
  "research_saturation": "Research area already saturated OR Opportunity exists",
  "research_gaps": ["Gap 1", "Gap 2", "Gap 3"],
  "innovation_opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
  "missing_capabilities": ["Missing 1", "Missing 2"],
  "new_key_features": ["New feature 1", "New feature 2"],
  "technical_feasibility": "1-2 sentences on technical feasibility",
  "market_feasibility": "1-2 sentences on market feasibility",
  "business_feasibility": "1-2 sentences on business model feasibility",
  "advantages": ["Advantage 1", "Advantage 2", "Advantage 3"],
  "disadvantages": ["Disadvantage 1", "Disadvantage 2"],
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "challenges": ["Challenge 1", "Challenge 2"],
  "failure_reasons": ["Failure reason 1", "Failure reason 2"],
  "team_roles": ["Role 1", "Role 2", "Role 3", "Role 4"],
  "team_size_estimate": 5,
  "development_time_months": 6,
  "budget_inr": 500000,
  "budget_breakdown": {{
    "development": 250000,
    "infrastructure": 100000,
    "marketing": 80000,
    "operations": 70000
  }},
  "final_verdict": "1-2 sentence final assessment of the startup idea's overall viability",
  "patent_novelty_score": 65,
  "research_support_score": 70,
  "market_demand_score": 75,
  "competitor_density_score": 40,
  "team_experience_score": 60,
  "metric_reasoning": {{
    "patent_novelty": "Why this novelty score was assigned",
    "research_support": "Why this research support score was assigned",
    "market_demand": "Why this market demand score was assigned",
    "competitor_density": "Why this competitor density score was assigned",
    "team_experience": "Why this team experience score was assigned"
  }}
}}"""

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            text = ""
            if api_key.startswith("sk-or-"):
                import requests
                resp = requests.post("https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": "google/gemini-2.0-flash-001", "messages": [{"role": "user", "content": prompt}]})
                text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            else:
                from google import genai as genai_new
                client   = genai_new.Client(api_key=api_key)
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
                text = response.text.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                start = 1 if lines[0].startswith("```") else 0
                end   = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
                text  = "\n".join(lines[start:end])
            return json.loads(text)
        except Exception as e:
            print(f"Gemini analysis failed: {e}")

    # ── Offline fallback with estimated scores ──
    print("Offline mode — using rule-based analysis with estimated scores.")
    is_saturated = "Research area already saturated" if len(papers) > 3 else "Opportunity exists"
    idea_lower = idea.lower()

    # Simple heuristic scoring
    novelty  = 70 if any(w in idea_lower for w in ['novel','unique','first','new approach']) else 55
    research = 75 if len(papers) >= 5 else (50 if len(papers) >= 2 else 30)
    demand   = 65 if any(w in idea_lower for w in ['rural','health','agriculture','education','farmer']) else 55
    compet   = 60 if any(w in idea_lower for w in ['ai','machine learning','blockchain']) else 40
    team_exp = 70 if any(w in idea_lower for w in ['ai','deep learning','hardware','edge']) else 55

    return {
        "what_ai_understood": f"The proposed idea revolves around: {idea}. It aims to solve an industry-specific problem using modern technology.",
        "startup_summary": f"An innovative venture targeting solution deployment for: {idea[:80]}",
        "domain_classification": "Cross-domain AI / Tech Venture",
        "keywords": ["Innovation", "Automation", "Efficiency", "AI", "Technology"],
        "idea_novelty_status": "Partially Exists",
        "existing_solutions": ["Similar tools exist in various forms", "Partial implementations are available"],
        "what_currently_exists": "There are existing solutions that address parts of this problem, but not the complete integrated approach described.",
        "suggested_new_features": ["Real-time AI processing", "Offline-first architecture", "Explainable outputs"],
        "research_saturation": is_saturated,
        "research_gaps": [
            "Lack of real-time low-latency performance optimization studies",
            "Limited benchmark datasets for domain-specific edge-cases"
        ],
        "innovation_opportunities": [
            "Integration of edge deployment models",
            "Explainability workflows built into the core stack"
        ],
        "missing_capabilities": ["High dependency on cloud networks", "Initial model latency constraints"],
        "new_key_features": ["Offline/Edge computing capability", "Automated feedback loop mechanisms"],
        "technical_feasibility": "High feasibility with standard models, but edge constraints exist.",
        "market_feasibility": "Moderate feasibility. High user demand, competitive landscape is active.",
        "business_feasibility": "Viable model with SaaS subscription or B2B enterprise licensing.",
        "advantages": ["Automated operations", "Low manual error margin", "Scalable architecture"],
        "disadvantages": ["High initial data acquisition cost", "Domain expert requirement"],
        "risks": ["Algorithm bias risk", "System integration downtime", "Data privacy concerns"],
        "challenges": ["Building quality training datasets", "User adoption in target segment"],
        "failure_reasons": ["Poor product-market fit alignment", "Data security compliance issues"],
        "team_roles": ["2 AI/ML Engineers", "1 Full Stack Developer", "1 Domain Expert", "1 Product Manager"],
        "team_size_estimate": 5,
        "development_time_months": 5,
        "budget_inr": 450000,
        "budget_breakdown": {
            "development": 200000,
            "infrastructure": 100000,
            "marketing": 80000,
            "operations": 70000
        },
        "final_verdict": "This startup idea shows moderate-to-high potential with a clear value proposition. Success depends on execution quality and go-to-market strategy.",
        "patent_novelty_score": novelty,
        "research_support_score": research,
        "market_demand_score": demand,
        "competitor_density_score": compet,
        "team_experience_score": team_exp,
        "metric_reasoning": {
            "patent_novelty": "Estimated based on idea keywords and existing solutions.",
            "research_support": f"Based on {len(papers)} papers found in academic databases.",
            "market_demand": "Estimated from target audience and problem domain.",
            "competitor_density": "Assessed from technology domain saturation.",
            "team_experience": "Based on technical complexity of the proposed solution."
        }
    }


# ── Mode-aware Startup Analysis (with itemized budget bill) ──────────────────


def get_startup_analysis(idea: str, papers: list, mode: str = "startup", project_type: str = "software") -> dict:
    """
    Fully mode-aware + hardware/software-aware startup analysis.
    mode: startup | hackathon | project
    project_type: hardware | software  (auto-detected by router)
    """
    papers_context = ""
    for idx, p in enumerate(papers[:8]):
        title    = p.get('title', 'N/A')
        abstract = (p.get('abstract') or 'N/A')[:300]
        papers_context += f"Paper {idx+1}: {title}\nAbstract: {abstract}\n\n"

    mode_contexts = {
        "startup": {
            "label": "Real Startup (going to market)",
            "feasibility_lens": "Evaluate as if this must survive in the Indian market. Consider regulation, competition from funded startups, user acquisition cost, unit economics, and funding availability.",
            "risk_lens": "Market risk, funding risk, technical debt, team burnout, regulatory compliance, competitor copying, wrong pricing, inability to reach PMF, churn.",
            "advantage_lens": "IP protection potential, first-mover advantage, network effects, unique data moat, switching costs, brand building.",
            "team_lens": "Full-time roles: technical founders, product manager, engineers with seniority, domain experts, sales/marketing. Include salaries.",
            "score_lens": "Score as a real venture investor: novelty=IP defensibility, research=tech maturity, demand=validated paying customers, competition=market crowding, team=expertise depth needed.",
            "budget_note": "Realistic Indian market rates. Include salaries, cloud infra, legal, marketing, 3-6 month runway.",
            "timeline_note": "Realistic months to shippable MVP v1 with paying customers.",
            "failure_lens": "Wrong market, no revenue, team conflict, better-funded competitor, running out of runway.",
            "verdict_tone": "Honest investor-style: worth building? biggest risk? what would make it succeed?",
        },
        "hackathon": {
            "label": "Hackathon / SIH (24-72 hour demo)",
            "feasibility_lens": "Can a working prototype be hacked together using free APIs, open-source models, and no-setup infrastructure in under 2 days by 3-4 people? Market viability is NOT relevant.",
            "risk_lens": "API rate limits during demo, connectivity issues, scope too wide, last-minute bugs, poor presentation, demo failing live, judges not understanding.",
            "advantage_lens": "Clear problem statement, impressive live demo, working end-to-end flow, social impact angle, unique tech stack, strong visual UI.",
            "team_lens": "3-4 person team: who builds frontend, who handles backend/API, who integrates ML, who prepares demo/slides. Each person does 2-3 things.",
            "score_lens": "Hackathon judge lens: novelty=how unique the idea feels, demand=social relevance, competition=existing apps (judges want novelty), team=achievable in 48hrs without expert skills.",
            "budget_note": "Zero cost for software (free tiers). Max Rs.5000 for any hardware/sensors.",
            "timeline_note": "1-3 days total. Break down by hours not months.",
            "failure_lens": "Demo crashes, scope too big, no working prototype by presentation time, bad pitch.",
            "verdict_tone": "Coach-style: is this winnable? what to focus on in 48 hours? what to cut?",
        },
        "project": {
            "label": "College Project / PPT / Academic Submission",
            "feasibility_lens": "Can a 3-5 student team with college-level skills build a working demo in 2-6 weeks with free tools? Prototype quality, not production quality.",
            "risk_lens": "Teammates not contributing, too complex a stack, not enough data for ML, vague problem statement, professor expecting different scope, poor documentation.",
            "advantage_lens": "Good learning opportunity, strong portfolio piece, can be extended to startup, demonstrates multiple technical skills, real-world problem professors appreciate.",
            "team_lens": "3-5 student roles: frontend dev, backend dev, ML/data person, report writer, team lead. Practical for college students.",
            "score_lens": "Professor/evaluator lens: novelty=originality vs typical student projects, demand=real-world relevance, competition=too many similar projects already done, team=learning required vs course knowledge.",
            "budget_note": "Student budget: Rs.0 preferred. Use GitHub Student Pack, free hosting, open-source everything. Max Rs.15000 if hardware needed.",
            "timeline_note": "2-6 weeks. Break down by weeks.",
            "failure_lens": "Demo breaks during viva, poor documentation, team coordination breakdown, dependency on paid APIs.",
            "verdict_tone": "Mentor-style: achievable in a semester? will it impress evaluators? most important thing to get right?",
        },
    }

    ctx = mode_contexts.get(mode, mode_contexts["startup"])

    # Hardware vs Software additional context
    hw_context = ""
    if project_type == "hardware":
        hw_context = """
PROJECT TYPE: HARDWARE (IoT / Embedded / Robotics / Physical Device)
HARDWARE-SPECIFIC RULES for budget:
- Include component costs: microcontrollers (Arduino Rs.500, Raspberry Pi Rs.4000), sensors, actuators, PCB
- Include prototyping costs: 3D printing, soldering, breadboards, jumper wires
- For hackathon: borrow components from lab, budget Rs.1000-5000 for components
- For project: Rs.3000-15000 for components and PCB fabrication
- For startup: hardware BOM (Bill of Materials), manufacturing, testing, certifications (BIS, CE)
- Team must include an embedded/hardware engineer
- Timeline is longer: hardware iteration cycles take weeks, not days
- Risks include: supply chain delays, component failure, firmware bugs, hardware-software integration
"""
    else:
        hw_context = """
PROJECT TYPE: SOFTWARE (Web App / Mobile App / AI/ML / SaaS / API)
SOFTWARE-SPECIFIC RULES for budget:
- No hardware component costs
- Focus on: development labor, cloud hosting, API costs, domain, design
- For hackathon: entirely free (Vercel, Railway, HuggingFace, Gemini free tier)
- For project: Rs.0-10000 using student/free tiers
- For startup: developer salaries, cloud infra, SaaS tools, marketing
"""

    import hashlib
    idea_hash = hashlib.md5(f"{idea}{mode}{project_type}".encode()).hexdigest()[:8]

    prompt = f"""You are TrustEval's AI analysis engine. Analysis ID: {idea_hash}

IDEA: "{idea}"
BUILD CONTEXT: {ctx['label']}
MODE: {mode}
{hw_context}

PAPERS FOUND:
{papers_context}

ANALYSIS LENS - apply this to EVERY field:
- FEASIBILITY: {ctx['feasibility_lens']}
- RISKS: {ctx['risk_lens']}
- ADVANTAGES: {ctx['advantage_lens']}
- TEAM: {ctx['team_lens']}
- SCORING: {ctx['score_lens']}
- BUDGET: {ctx['budget_note']}
- TIMELINE: {ctx['timeline_note']}
- FAILURE: {ctx['failure_lens']}
- VERDICT: {ctx['verdict_tone']}

Return ONLY a raw JSON object, no markdown, no code fences:

{{
  "extracted_keywords": ["3-6 short keywords from the idea, e.g. AI, AgriTech, IoT"],
  "what_ai_understood": "2-3 sentences: what is this idea, what problem, who are users",
  "startup_summary": "1 paragraph summary for {ctx['label']} — tone and scope must match the mode",
  "domain_classification": "AgriTech / HealthTech / FinTech / EdTech / Cybersecurity / AI-ML / etc.",
  "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "idea_novelty_status": "Already Exists OR Partially Exists OR Novel",
  "existing_solutions": ["name real existing tool/product 1","existing tool 2"],
  "what_currently_exists": "Name specific real products, tools, or research that already exists",
  "suggested_new_features": ["feature 1 to stand out","feature 2","feature 3"],
  "research_saturation": "Research area already saturated OR Opportunity exists",
  "research_gaps": ["specific gap 1 from papers","gap 2","gap 3"],
  "innovation_opportunities": ["concrete opportunity 1","opportunity 2","opportunity 3"],
  "missing_capabilities": ["what is technically missing today","missing capability 2"],
  "technical_feasibility": "Answer using FEASIBILITY LENS — is it buildable for this mode?",
  "market_feasibility": "For startup: paying market? For hackathon: impressive to judges? For project: professor value?",
  "business_feasibility": "For startup: revenue model. For hackathon: future potential only. For project: academic value.",
  "advantages": ["advantage 1 specific to this mode","advantage 2","advantage 3","advantage 4"],
  "disadvantages": ["disadvantage 1 relevant to this mode","disadvantage 2","disadvantage 3"],
  "risks": ["risk 1 specific to this mode","risk 2","risk 3","risk 4"],
  "challenges": ["challenge 1 team will actually face","challenge 2","challenge 3"],
  "failure_reasons": ["realistic failure reason 1 for this mode","failure reason 2"],
  "team_roles": ["specific role 1 with what they do","role 2","role 3","role 4"],
  "team_size_estimate": 4,
  "development_time_months": 0.08,
  "budget_inr": 3000,
  "budget_breakdown": {{"development": 0,"infrastructure": 0,"hardware": 3000,"misc": 0}},
  "itemized_budget": [
    {{
      "item": "Cost item name specific to this idea and mode",
      "category": "Development OR Infrastructure OR Marketing OR Operations OR Hardware OR Data OR Design OR Misc",
      "amount_inr": 0,
      "justification": "Exactly WHY this costs what it does — hours, tools, service, reason needed",
      "cost_reduction_tip": "Specific free alternative or cheaper option for THIS exact cost"
    }}
  ],
  "total_cost_reduction_summary": "2-3 sentences: strategy to cut cost, specific to this mode",
  "final_verdict": "Verdict in the tone described — specific, actionable, honest",
  "patent_novelty_score": 60,
  "research_support_score": 55,
  "market_demand_score": 65,
  "competitor_density_score": 45,
  "team_experience_score": 50,
  "metric_reasoning": {{
    "patent_novelty": "Why this score through the mode lens",
    "research_support": "Why this score",
    "market_demand": "Why this score — what demand means in this mode",
    "competitor_density": "Why this score — what competition means in this mode",
    "team_experience": "Why this score — expertise needed for this mode"
  }}
}}

RULES:
- itemized_budget: 5-10 items specific to THIS idea and THIS mode
- hackathon: most items Rs.0 (free tiers), total max Rs.5000
- project: max total Rs.15000, free/student tools
- startup: realistic Indian market rates with salaries
- Sum of itemized_budget amounts MUST equal budget_inr
- development_time_months: hackathon=0.08, project=0.5-1.5, startup=3-12
- team_size: hackathon=3-4, project=3-5, startup=4-10
- DO NOT use the example values above — generate real numbers for this specific idea"""

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        try:
            text = ""
            if api_key.startswith("sk-or-"):
                import requests
                resp = requests.post("https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"model": "google/gemini-2.0-flash-001", "messages": [{"role": "user", "content": prompt}]})
                text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
            else:
                from google import genai as genai_new
                client   = genai_new.Client(api_key=api_key)
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
                text = response.text.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                start = 1 if lines[0].startswith("```") else 0
                end   = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
                text  = "\n".join(lines[start:end])
            result = json.loads(text)
            if "extracted_keywords" not in result:
                result["extracted_keywords"] = result.get("keywords", [])[:5]
            return result
        except Exception as e:
            print(f"[get_startup_analysis] Gemini failed: {e}")

    # ── Offline fallback — GEMINI KEY NOT SET ────────────────────────────────
    # This runs when GEMINI_API_KEY is not configured.
    # To get real AI analysis, set GEMINI_API_KEY in your environment.
    print(f"[get_startup_analysis] No Gemini key — offline fallback. mode={mode} type={project_type}")
    print("  → Set GEMINI_API_KEY environment variable for real AI analysis.")
    idea_lower = idea.lower()
    words = [w.capitalize() for w in idea.split() if len(w) > 4 and w.isalpha()][:6]
    is_saturated = "Research area already saturated" if len(papers) > 3 else "Opportunity exists"

    # Scores vary based on actual idea content
    novelty  = 75 if any(w in idea_lower for w in ['novel','unique','first','new','innovative']) else \
               60 if any(w in idea_lower for w in ['ai','ml','blockchain','quantum']) else 50
    research = 80 if len(papers) >= 7 else (65 if len(papers) >= 4 else (45 if len(papers) >= 1 else 25))
    demand   = 75 if any(w in idea_lower for w in ['rural','health','farmer','education','patient','student']) else \
               65 if any(w in idea_lower for w in ['enterprise','business','finance','security']) else 55
    compet   = 75 if any(w in idea_lower for w in ['chatgpt','openai','google','amazon','meta']) else \
               55 if any(w in idea_lower for w in ['ai','machine learning','app']) else 35
    team_exp = 80 if any(w in idea_lower for w in ['deep learning','robotics','hardware','embedded','blockchain']) else \
               60 if any(w in idea_lower for w in ['ai','ml','iot','drone']) else 45

    # Hardware-specific budget additions
    hw_budget_extra = 0
    hw_bill_items = []
    if project_type == "hardware":
        if mode == "hackathon":
            hw_budget_extra = 3000
            hw_bill_items = [
                {"item": "Microcontroller (Arduino/ESP32)", "category": "Hardware", "amount_inr": 800,
                 "justification": "Core controller for the hardware prototype. Arduino Uno ~Rs.500, ESP32 ~Rs.350.",
                 "cost_reduction_tip": "Borrow from your college electronics lab. Most labs have Arduino kits available."},
                {"item": "Sensors & Components", "category": "Hardware", "amount_inr": 1500,
                 "justification": "Sensors specific to your project (temperature, ultrasonic, camera module, etc.).",
                 "cost_reduction_tip": "Buy from Robocraze or Robu.in for 30-40% cheaper than Amazon. Borrow from lab if possible."},
                {"item": "Breadboard, Wires, LEDs", "category": "Hardware", "amount_inr": 300,
                 "justification": "Prototyping components for circuit assembly.",
                 "cost_reduction_tip": "Every college lab has these. Just borrow them."},
                {"item": "3D Print / Enclosure (optional)", "category": "Hardware", "amount_inr": 400,
                 "justification": "Basic enclosure to make the demo look polished.",
                 "cost_reduction_tip": "Skip enclosure for hackathon — judges don't care about the box, only if it works."},
            ]
        elif mode == "project":
            hw_budget_extra = 6000
            hw_bill_items = [
                {"item": "Microcontroller Kit", "category": "Hardware", "amount_inr": 1500,
                 "justification": "Arduino Mega or Raspberry Pi for the core hardware prototype.",
                 "cost_reduction_tip": "Borrow from college lab. If buying, Raspberry Pi Zero 2W costs only Rs.1,200."},
                {"item": "Sensors & Modules", "category": "Hardware", "amount_inr": 2500,
                 "justification": "2-4 sensors for the project demo (camera, temperature, GPS, etc.).",
                 "cost_reduction_tip": "Buy from Robu.in or Electronicscomp.in — 40% cheaper than Amazon/Flipkart."},
                {"item": "PCB / Wiring Materials", "category": "Hardware", "amount_inr": 800,
                 "justification": "Breadboard, jumper wires, resistors, capacitors for circuit assembly.",
                 "cost_reduction_tip": "College lab supplies these for free. Ask your hardware lab professor."},
                {"item": "3D Printed Enclosure", "category": "Hardware", "amount_inr": 700,
                 "justification": "3D printed case for professional-looking demo during evaluation.",
                 "cost_reduction_tip": "College design/mechanical labs have 3D printers. Book a slot — usually free for students."},
                {"item": "Power Supply / Battery", "category": "Hardware", "amount_inr": 500,
                 "justification": "Li-Ion battery pack or power bank for portable demo.",
                 "cost_reduction_tip": "Use an old 10,000mAh power bank. Already in your bag."},
            ]
        else:  # startup hardware
            hw_budget_extra = 80000
            hw_bill_items = [
                {"item": "Hardware BOM (Bill of Materials) - 10 units", "category": "Hardware", "amount_inr": 25000,
                 "justification": "Components for 10 prototype units: MCU, sensors, PCB, enclosure per unit at ~Rs.2,500 each.",
                 "cost_reduction_tip": "Order in bulk from Alibaba for 50-60% cost reduction. Negotiate MOQ with Indian distributors."},
                {"item": "PCB Design & Fabrication", "category": "Hardware", "amount_inr": 15000,
                 "justification": "Custom PCB design (EasyEDA/KiCAD) + 10 PCBs fabricated from JLCPCB or PCBCart.",
                 "cost_reduction_tip": "JLCPCB offers 10 PCBs for ~$2. Only get PCBs made after breadboard prototype works."},
                {"item": "Hardware Engineer (2 months)", "category": "Development", "amount_inr": 30000,
                 "justification": "Embedded/firmware engineer at Rs.15,000/month for 2 months. Writes MCU firmware, handles integration.",
                 "cost_reduction_tip": "Hire an EC/EE final-year intern at Rs.8,000-10,000/month. Many want hardware project experience."},
                {"item": "Testing & Certification (BIS/CE)", "category": "Operations", "amount_inr": 10000,
                 "justification": "Basic testing lab charges + BIS registration research. Full certification comes at scale.",
                 "cost_reduction_tip": "Skip formal certification for MVP stage. Only required when selling commercially."},
            ]

    if mode == "hackathon":
        sw_budget = 0
        budget = sw_budget + hw_budget_extra
        months = 0.08; team_size = 3 + (1 if project_type == "hardware" else 0)
        team_roles = (["Frontend Dev (UI + demo)","Backend Dev (API + ML)","Presenter (slides + pitch)"] +
                      (["Hardware Engineer (circuit + firmware)"] if project_type == "hardware" else []))
        sw_bill = [
            {"item": "Cloud Hosting (Vercel/Railway free)", "category": "Infrastructure", "amount_inr": 0,
             "justification": "Free tier handles hackathon traffic.","cost_reduction_tip": "Already free."},
            {"item": "AI/ML APIs (Gemini free tier)", "category": "Infrastructure", "amount_inr": 0,
             "justification": "Gemini API: 1500 free requests/day. More than enough for a hackathon demo.",
             "cost_reduction_tip": "Already free. Also try HuggingFace Inference API (free)."},
        ]
        bill = sw_bill + hw_bill_items
        adv = ["Entire software stack is free","Working demo achievable in 48 hours",
               "Strong social impact angle impresses judges","Great portfolio + resume piece"]
        risks = ["API rate limits crash the demo","Scope too wide for 48 hours",
                 "Hardware fails during demo" if project_type=="hardware" else "Integration bug at last minute",
                 "Team does not finish core feature"]
        challenges = ["Getting end-to-end demo working in 48 hours",
                      "Hardware-software integration" if project_type=="hardware" else "Scope control during hackathon"]
        verdict = f"Strong {'hardware' if project_type=='hardware' else 'software'} hackathon project. Build ONE core feature that works live. Judges want to see it run, not a complete product."
        tech_feas = f"{'Hardware prototype is achievable in 48 hours using pre-soldered modules and free firmware libraries.' if project_type=='hardware' else 'Fully achievable using free APIs and no-setup cloud hosting.'}  Build a working demo, not a finished product."
        mkt_feas = "Problem relevance and live demo quality are what win hackathons. Social/rural impact angle adds points."
        biz_feas = "Not relevant for hackathon. Mention startup potential in Q&A only."
        failure = ["Demo doesn't work on presentation day","Built too many features, none working completely"]
        breakdown = {"hardware": hw_budget_extra, "infrastructure": 0, "misc": 0}

    elif mode == "project":
        sw_budget = 5000
        budget = sw_budget + hw_budget_extra
        months = 1.5; team_size = 4 + (1 if project_type == "hardware" else 0)
        team_roles = (["Full Stack Developer (React + backend)","ML/Data Engineer",
                       "UI Designer (Figma)","Docs + Presentation lead"] +
                      (["Hardware Engineer (circuit + firmware)"] if project_type == "hardware" else []))
        sw_bill = [
            {"item": "Cloud Hosting (free tier)", "category": "Infrastructure", "amount_inr": 0,
             "justification": "Vercel/Railway free tier is enough for college project demo.",
             "cost_reduction_tip": "Already free. Apply for GitHub Student Pack for extra credits."},
            {"item": "API Credits (if needed)", "category": "Data", "amount_inr": 2000,
             "justification": "Small charges if you exceed free tier on paid APIs.",
             "cost_reduction_tip": "Use Kaggle datasets (free), HuggingFace (free), and Gemini free tier."},
            {"item": "Premium UI Template (optional)", "category": "Design", "amount_inr": 2000,
             "justification": "Paid Figma template or component library for polished demo.",
             "cost_reduction_tip": "Use shadcn/ui or Tailwind UI community components — completely free."},
            {"item": "Report Printing", "category": "Misc", "amount_inr": 1000,
             "justification": "Physical project report for department submission.",
             "cost_reduction_tip": "Ask if PDF submission is accepted — most colleges now allow it."},
        ]
        bill = sw_bill + hw_bill_items
        adv = ["Good learning opportunity","Strong portfolio project",
               "Hardware + software integration skill" if project_type=="hardware" else "Full-stack development experience",
               "Can be extended into a startup"]
        risks = ["Team coordination breakdown","Too complex stack for timeline",
                 "Component shortage or failure" if project_type=="hardware" else "Not enough data for ML model",
                 "Integration issues in final week"]
        challenges = ["Consistent contribution from all team members",
                      "Hardware-software integration before submission" if project_type=="hardware" else "Getting all features working before submission"]
        verdict = f"Achievable {'hardware+software' if project_type=='hardware' else 'software'} project in 6-8 weeks. Focus on a clean working demo and thorough documentation."
        tech_feas = f"{'Hardware prototype is achievable with standard modules. Focus on working integration over custom PCB.' if project_type=='hardware' else 'High feasibility using Python, React, and free APIs.'} 6-week timeline is realistic for a student team."
        mkt_feas = "Real-world problem relevance impresses evaluators. Include market impact in your project report."
        biz_feas = "Include a 'Future Scope' section about monetization. Shows initiative to evaluators."
        failure = ["Demo breaks during viva","Poor documentation — evaluators can't understand what was built",
                   "Hardware doesn't arrive in time" if project_type=="hardware" else "ML model accuracy too low for demo"]
        breakdown = {"software_dev": sw_budget - 3000, "hardware": hw_budget_extra, "misc": 3000} if project_type=="hardware" else {"infrastructure": 2000, "design": 2000, "misc": 1000}

    else:  # startup
        sw_budget = 370000
        budget = sw_budget + hw_budget_extra
        months = 5 + (3 if project_type == "hardware" else 0)
        team_size = 5 + (2 if project_type == "hardware" else 0)
        team_roles = (["2x Full Stack Developer (Rs.30k/month)","1x ML/AI Engineer (Rs.35k/month)",
                       "1x Product Manager (Rs.40k/month)","1x Growth/Marketing (Rs.25k/month)"] +
                      (["1x Hardware/Embedded Engineer (Rs.35k/month)","1x Mechanical/PCB Designer (Rs.30k/month)"] if project_type=="hardware" else []))
        sw_bill = [
            {"item": "Full Stack Dev (2 devs x 3 months)", "category": "Development", "amount_inr": 180000,
             "justification": "2 developers at Rs.30,000/month for 3 months. React frontend, FastAPI backend, database, auth.",
             "cost_reduction_tip": "Hire final-year CS interns at Rs.8,000-12,000/month. Use boilerplates to cut 40% dev time."},
            {"item": "ML/AI Engineering (1 engineer x 2 months)", "category": "Development", "amount_inr": 70000,
             "justification": "1 ML engineer at Rs.35,000/month for 2 months. Model selection, training, integration.",
             "cost_reduction_tip": "Use pre-trained HuggingFace models. Cuts timeline from 2 months to 2 weeks."},
            {"item": "Cloud Infrastructure (AWS/GCP)", "category": "Infrastructure", "amount_inr": 40000,
             "justification": "VM, managed DB, storage, CDN for 5+ months of MVP operation.",
             "cost_reduction_tip": "Apply for AWS Activate (free $1000) or GCP for Startups (free $2000)."},
            {"item": "AI/ML API Usage", "category": "Infrastructure", "amount_inr": 15000,
             "justification": "LLM API calls at ~Rs.3,000/month during dev and early testing.",
             "cost_reduction_tip": "Use Gemini free tier. Self-host Ollama for dev/test environment."},
            {"item": "Domain + Email + SSL", "category": "Infrastructure", "amount_inr": 5000,
             "justification": "Custom domain, business email, SSL certificate for 1 year.",
             "cost_reduction_tip": "Zoho Mail free tier instead of Google Workspace. SSL is always free via Let's Encrypt."},
            {"item": "UI/UX Design", "category": "Development", "amount_inr": 20000,
             "justification": "Figma Pro + freelance designer for wireframes and key screens.",
             "cost_reduction_tip": "Use Figma free tier. Hire design student for Rs.8,000 total project."},
            {"item": "Legal (Registration + ToS)", "category": "Operations", "amount_inr": 15000,
             "justification": "LLP registration Rs.5,000 + Terms of Service/Privacy Policy drafting.",
             "cost_reduction_tip": "iStart India portal for free LLP. Use Termly.io for free ToS."},
            {"item": "Marketing & User Acquisition", "category": "Marketing", "amount_inr": 70000,
             "justification": "LinkedIn content, Google Ads pilot, PR outreach for first users.",
             "cost_reduction_tip": "Start 100% organic: LinkedIn, Reddit, Product Hunt. Delay paid ads until after PMF."},
            {"item": "Operations Buffer", "category": "Operations", "amount_inr": 25000,
             "justification": "Buffer for unexpected costs across 5+ months.",
             "cost_reduction_tip": "Track every rupee from day 1. Open-source tools for everything possible."},
        ]
        bill = sw_bill + hw_bill_items
        adv = (["Unique hardware+software integration is hard to copy" if project_type=="hardware" else "Pure software scales with zero marginal cost",
               "Recurring SaaS revenue potential","Solves validated real-world pain point",
               "Strong research backing increases investor credibility"])
        risks = (["Hardware supply chain delays add months to timeline"] if project_type=="hardware" else []) + \
                ["Running out of runway before PMF","Better-funded competitor","Wrong initial market segment"]
        challenges = (["Hardware-software integration complexity" if project_type=="hardware" else "ML model accuracy in production",
                      "Acquiring first 10 paying customers","Keeping burn rate low while building quality product"])
        verdict = f"Viable {'hardware+software' if project_type=='hardware' else 'software'} startup. Validate with real users in 60 days. Hardware adds 2-3 months and Rs.{hw_budget_extra:,} to the budget but also creates a stronger defensible moat." if project_type=="hardware" else "Viable startup with clear market need. Keep MVP scope tight and find 3 paying customers before raising any money."
        tech_feas = f"{'Hardware+software integration is complex but achievable. Use proven modules to reduce risk.' if project_type=='hardware' else 'Technically feasible with existing open-source stack.'} Main risk is underestimating integration complexity."
        mkt_feas = "Real demand exists. Competition is present but fragmented. Win through deep domain focus and superior UX."
        biz_feas = "SaaS subscription Rs.499-Rs.2,999/month is viable. Aim for 50 paying users in 6 months before raising."
        failure = ["Wrong market segment — solving problem nobody pays for",
                   "Hardware defects discovered post-launch requiring costly recalls" if project_type=="hardware" else "Technical co-founder unavailable, outsourced dev leads to poor code quality"]
        breakdown = {"development": sw_budget // 2, "hardware": hw_budget_extra, "infrastructure": 60000, "marketing": 70000, "operations": 40000} if project_type=="hardware" else {"development": 285000, "infrastructure": 60000, "marketing": 70000, "operations": 25000}

    # ── Idea-specific dynamic content (varies per idea) ──────────────────────
    # Extract key domain signals from the idea
    idea_words = [w.lower().strip('.,;:') for w in idea.split() if len(w) > 3]

    # Detect domain-specific disadvantages
    hw_dis = "Hardware iteration cycles slow development — each bug fix requires physical rebuild" if project_type=="hardware" else None
    data_dis = "Requires large high-quality labelled dataset to train accurate ML models" if any(w in idea_lower for w in ['ai','ml','detect','predict','classify','recogni']) else None
    privacy_dis = "Sensitive user data requires strict privacy compliance (GDPR, PDPB India)" if any(w in idea_lower for w in ['health','medical','patient','personal','finance','bank']) else None
    cost_dis = "High infrastructure cost for real-time processing at scale" if any(w in idea_lower for w in ['real-time','realtime','live','stream','video']) else None
    domain_dis = f"Deep domain expertise required in the target domain"

    disadvantages_dynamic = [x for x in [hw_dis, data_dis, privacy_dis, cost_dis] if x]
    if not disadvantages_dynamic:
        disadvantages_dynamic = [
            "Initial user adoption requires significant change management effort",
            "Niche target audience limits total addressable market size",
        ]
    if len(disadvantages_dynamic) < 2:
        disadvantages_dynamic.append("Building trust with early users requires proven track record")

    # Detect domain-specific existing solutions
    existing_map = {
        'health': ['Epic Systems EHR','Practo health platform','1mg telehealth'],
        'farm': ['Cropin AgriTech','DeHaat platform','Fasal crop advisory'],
        'agri': ['Cropin AgriTech','AgriFuse','Fasal IoT'],
        'finance': ['Zerodha/Groww trading apps','Razorpay payment APIs','PhonePe UPI'],
        'crypto': ['Binance/CoinDCX trading bots','3Commas automated trading','Kite Connect API'],
        'educat': ['Byju\'s learning app','Khan Academy AI tutor','Unacademy platform'],
        'learn': ['Duolingo adaptive learning','Anki spaced repetition','Notion AI'],
        'memory': ['Anki flashcard system','Notion AI','Roam Research'],
        'mental': ['Wysa mental health chatbot','YourDOST counselling','Headspace meditation'],
        'cyber': ['Darktrace AI security','CrowdStrike endpoint','Snyk code security'],
        'secur': ['Okta IAM platform','Cloudflare security','Palo Alto Networks'],
        'robot': ['ROS robot framework','OpenAI Robotics research','Boston Dynamics'],
        'drone': ['DJI drone platform','ArduPilot open-source','Skydio AI drones'],
        'traffic': ['Google Maps live traffic','HERE Maps API','MapmyIndia'],
        'waste': ['Kabadiwalla Connect','Swachh platform','Waste Ventures India'],
        'water': ['IBM Water Intelligence','Xylem water IoT','SmartWater Networks'],
        'energy': ['Opower energy analytics','Siemens energy grid AI','GridBeyond'],
    }
    existing_dynamic = ["Similar open-source tools and libraries exist"]
    for kw, solutions in existing_map.items():
        if kw in idea_lower:
            existing_dynamic = solutions[:2]
            break

    # What currently exists - idea specific
    what_exists_map = {
        'memory': "Spaced repetition tools like Anki exist but lack AI-powered personalization and natural language interaction.",
        'health': "EHR systems and telemedicine apps exist but are fragmented and lack unified AI-powered insights.",
        'crop': "Generic pest detection apps exist but lack hyper-local, language-specific advisory for Indian farmers.",
        'farm': "Agri-advisory platforms exist but rely on periodic human expert calls rather than real-time AI.",
        'crypto': "Algorithmic trading bots exist for professional traders but are too complex for retail investors.",
        'learn': "LMS platforms exist but lack adaptive AI that adjusts in real-time to individual learning pace.",
        'cyber': "Enterprise security tools exist but are cost-prohibitive for SMEs and startups.",
        'robot': "Industrial robots exist but lack the contextual intelligence needed for unstructured environments.",
        'waste': "Waste management apps exist but lack IoT-based real-time monitoring and route optimization.",
        'mental': "Mental health apps exist but lack personalized AI therapy calibrated to Indian cultural context.",
        'traffic': "Navigation apps exist but lack AI-powered predictive routing based on real-time event data.",
    }
    what_exists = "Partial solutions exist in this space but none fully address the specific problem for the target audience."
    for kw, desc in what_exists_map.items():
        if kw in idea_lower:
            what_exists = desc
            break

    # Research gaps - idea specific
    gap_map = {
        'detect': ["Real-time detection with <100ms latency on edge devices","Generalisation across diverse geographic datasets"],
        'health': ["AI explainability in clinical decision support","Bias in medical AI across demographic groups"],
        'farm': ["Multilingual voice-based advisory systems for low-literacy farmers","Hyper-local crop disease models for Indian soil types"],
        'memory': ["Personalized spaced repetition algorithms using real-time cognitive load signals","Long-term retention measurement beyond 6 months"],
        'finance': ["Explainable AI for retail investment recommendations under Indian SEBI regulations","Fairness in credit scoring for thin-file borrowers"],
        'cyber': ["Zero-day vulnerability detection using LLM-based code analysis","AI-driven patch prioritisation for SME budgets"],
        'robot': ["Sim-to-real transfer for manipulation in unstructured Indian environments","Energy-efficient edge AI for battery-powered robots"],
        'learn': ["Adaptive difficulty calibration using real-time EEG/biometric signals","Engagement prediction models for vernacular content"],
    }
    research_gaps_dynamic = ["Limited benchmark datasets specific to Indian deployment context",
                             "Lack of multilingual support research for this domain"]
    for kw, gaps in gap_map.items():
        if kw in idea_lower:
            research_gaps_dynamic = gaps
            break

    # Innovation opportunities - idea specific
    innov_map = {
        'farm': ["Offline-first mobile app with SMS fallback for no-internet zones","Vernacular voice interface in 12 Indian languages"],
        'health': ["Federated learning to train models without sharing patient data","Wearable integration for continuous passive health monitoring"],
        'memory': ["Multimodal memory cues (audio + visual + text) for stronger retention","Peer learning networks where high-performers share memory strategies"],
        'crypto': ["Explainable AI showing exactly why a trade signal was generated","Social copy-trading with transparent strategy performance history"],
        'cyber': ["Automated remediation that patches code instead of just alerting","Natural language query interface for non-technical security teams"],
        'robot': ["Digital twin simulation for safe robot training before deployment","Crowdsourced edge case collection via gamified human feedback"],
        'waste': ["Blockchain-based verified recycling credit marketplace","Computer vision bin fill-level monitoring with IoT sensors"],
        'learn': ["AI tutor that detects confusion from webcam micro-expressions","Curriculum personalisation based on career goal mapping"],
    }
    innov_opps = ["Vernacular language support for wider reach","Integration with existing popular tools via API"]
    for kw, opps in innov_map.items():
        if kw in idea_lower:
            innov_opps = opps
            break

    # Suggested new features - idea specific
    features_map = {
        'memory': ["AI-generated visual memory palaces","Spaced repetition with biometric stress detection","Group study challenges with leaderboard"],
        'health': ["Offline diagnosis mode for rural low-connectivity areas","Multilingual symptom checker in 10 Indian languages","Caregiver dashboard for family monitoring"],
        'farm': ["WhatsApp chatbot integration for farmer outreach","Satellite imagery + IoT sensor fusion for field-level insights","Crop insurance advisory linked to weather APIs"],
        'crypto': ["Plain-English explanation of every AI trade signal","Paper trading mode to test strategies risk-free","WhatsApp alerts for trade triggers"],
        'cyber': ["One-click PR to auto-patch detected vulnerabilities","Slack/Teams bot for real-time threat alerts","Compliance scorecard generation (SOC2, ISO27001)"],
        'learn': ["AI explains concepts using analogies from student's own interests","Daily 5-minute micro-lessons optimised for commute time","Parent dashboard showing learning gap visualisation"],
    }
    suggested_features = ["Real-time collaborative features","Offline mode for low-connectivity areas","AI-powered personalisation engine"]
    for kw, feats in features_map.items():
        if kw in idea_lower:
            suggested_features = feats
            break

    return {
        "extracted_keywords": words or ["AI","Technology","Innovation"],
        "project_type": project_type,
        "what_ai_understood": f"The idea involves: {idea[:150]}. This is a {'hardware+software' if project_type=='hardware' else 'software-only'} project targeting a real-world problem.",
        "startup_summary": f"A {ctx['label']} {'hardware+software' if project_type=='hardware' else 'software'} project: {idea[:120]}. Timeline: {'~2 days' if months < 0.1 else f'~{months} months'}. Team: {team_size} people.",
        "domain_classification": "Cross-domain AI / Tech",
        "keywords": words or ["Innovation","AI","Technology"],
        "idea_novelty_status": "Partially Exists",
        "existing_solutions": existing_dynamic,
        "what_currently_exists": what_exists,
        "suggested_new_features": suggested_features,
        "research_saturation": is_saturated,
        "research_gaps": research_gaps_dynamic,
        "innovation_opportunities": innov_opps,
        "missing_capabilities": ["Real-time data pipeline for this domain","Domain-specific training data at scale"],
        "technical_feasibility": tech_feas,
        "market_feasibility": mkt_feas,
        "business_feasibility": biz_feas,
        "advantages": adv,
        "disadvantages": disadvantages_dynamic,
        "risks": risks,
        "challenges": challenges,
        "failure_reasons": failure,
        "team_roles": team_roles,
        "team_size_estimate": team_size,
        "development_time_months": months,
        "budget_inr": budget,
        "budget_breakdown": breakdown,
        "itemized_budget": bill,
        "total_cost_reduction_summary": (
            "Zero-cost software stack using free tiers. Borrow all hardware components from college lab to keep budget under Rs.2000." if mode=="hackathon" and project_type=="hardware" else
            "Entire software stack is free for a hackathon — Vercel, Railway, Gemini, HuggingFace all have generous free tiers." if mode=="hackathon" else
            "Use GitHub Student Pack for free cloud credits. Borrow hardware from college lab. Buy components from Robu.in instead of Amazon." if mode=="project" and project_type=="hardware" else
            "Use GitHub Student Pack, free cloud tiers, and open-source tools to keep total under Rs.8,000." if mode=="project" else
            "Apply for AWS Activate and GCP for Startups for free cloud credits. Hire interns instead of senior devs. Use HuggingFace models instead of training from scratch. Order hardware components in bulk from Alibaba." if project_type=="hardware" else
            "Apply for AWS Activate for free credits. Hire CS interns instead of senior devs. Use pre-trained HuggingFace models to cut AI costs by 80%."
        ),
        "final_verdict": verdict,
        "patent_novelty_score": novelty,
        "research_support_score": research,
        "market_demand_score": demand,
        "competitor_density_score": compet,
        "team_experience_score": team_exp,
        "metric_reasoning": {
            "patent_novelty": f"{'Hardware+software combo has stronger IP defensibility.' if project_type=='hardware' else 'Software idea novelty.'} Score reflects existing competition in this space.",
            "research_support": f"Based on {len(papers)} papers found. {'Strong academic base.' if len(papers) >= 4 else 'Limited research coverage — gap to fill.'}",
            "market_demand": f"{'Social/rural impact boosts demand score.' if any(w in idea_lower for w in ['rural','farmer','health','education']) else 'Market demand estimated from domain signals.'}",
            "competitor_density": f"{'High competition from tech giants.' if compet >= 60 else 'Moderate competition with room for differentiation.'}",
            "team_experience": f"{'Hardware expertise needed adds team complexity.' if project_type=='hardware' else 'Standard software skills sufficient.'} Score reflects expertise depth needed for {mode} context.",
        }
    }
