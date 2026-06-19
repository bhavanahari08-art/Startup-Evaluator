"""
Research Chat router — conversational research paper + patent intelligence.
"""
import os
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.services.research_intel import (
    search_all_research,
    get_research_chat_response,
)

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ResearchChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    paper_limit: int = 10


class ResearchChatResponse(BaseModel):
    reply: str
    papers: List[Dict[str, Any]]
    patents: List[Dict[str, Any]]
    query_used: str


class PatentKeywordsRequest(BaseModel):
    idea: str
    patents: List[Dict[str, Any]] = []


class PatentKeywordsResponse(BaseModel):
    keywords: List[str]
    patent_analysis: str
    uniqueness_opportunities: List[str]
    conflict_risks: List[str]
    modification_suggestions: List[str]
    overlap_score: int  # 0-100, higher = more overlap with existing patents


@router.post("/chat", response_model=ResearchChatResponse)
async def research_chat(body: ResearchChatRequest):
    query   = body.message.strip()
    results = search_all_research(query, paper_limit=body.paper_limit)
    papers  = results["papers"]
    patents = results["patents"]
    history = [{"role": m.role, "content": m.content} for m in body.history]
    reply   = get_research_chat_response(
        user_message=query,
        conversation_history=history,
        papers=papers,
        patents=patents,
    )
    return ResearchChatResponse(reply=reply, papers=papers, patents=patents, query_used=query)


@router.post("/patent-keywords", response_model=PatentKeywordsResponse)
async def patent_keywords(body: PatentKeywordsRequest):
    """
    Deep patent keyword extraction and conflict analysis using Gemini AI.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    patent_context = "\n".join([f"- {p.get('title','')}: {p.get('description', p.get('url',''))}" for p in body.patents])

    prompt = f"""You are a patent intelligence expert. Analyze this startup idea and the patent databases searched.

Startup Idea: "{body.idea}"

Patent Databases Searched:
{patent_context}

Provide a patent intelligence analysis. Return ONLY a raw JSON object:
{{
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"],
  "patent_analysis": "2-3 sentence analysis of the patent landscape for this idea",
  "uniqueness_opportunities": ["Opportunity 1", "Opportunity 2", "Opportunity 3"],
  "conflict_risks": ["Risk 1", "Risk 2"],
  "modification_suggestions": ["Suggestion 1 to avoid conflicts", "Suggestion 2", "Suggestion 3"],
  "overlap_score": 35
}}"""

    if api_key:
        try:
            from google import genai as genai_new
            client = genai_new.Client(api_key=api_key)
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            text = response.text.strip()
            if text.startswith("```"):
                lines = text.splitlines()
                text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            import json as _json
            data = _json.loads(text)
            return PatentKeywordsResponse(**data)
        except Exception as e:
            print(f"Patent keywords Gemini error: {e}")

    # Fallback
    words = [w for w in body.idea.split() if len(w) > 4][:6]
    return PatentKeywordsResponse(
        keywords=words or ["innovation", "technology", "solution", "platform", "system"],
        patent_analysis="Patent landscape analysis requires a Gemini API key. Connect one for deep patent intelligence.",
        uniqueness_opportunities=["Novel combination of technologies", "Unique target market segment", "Innovative delivery mechanism"],
        conflict_risks=["Possible overlap with existing software patents", "Method patents in this domain may apply"],
        modification_suggestions=["Focus on unique implementation details", "Document novel technical approaches", "Consider provisional patent filing"],
        overlap_score=30
    )
