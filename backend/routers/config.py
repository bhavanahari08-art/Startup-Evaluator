"""
Config router — allows setting runtime configuration like Gemini API key.
Key is stored in memory for the current server session.
For persistence, users should set GEMINI_API_KEY in their .env file.
"""
import os
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# In-memory runtime config (overrides env var for the current session)
_runtime_config = {}


class SetKeyRequest(BaseModel):
    gemini_api_key: str


@router.post("/gemini-key")
def set_gemini_key(body: SetKeyRequest):
    key = body.gemini_api_key.strip()
    if not key:
        # Clear the key
        _runtime_config.pop("GEMINI_API_KEY", None)
        os.environ.pop("GEMINI_API_KEY", None)
        return {"status": "cleared", "message": "Gemini API key cleared."}

    # Set in both runtime dict and os.environ so all services pick it up immediately
    _runtime_config["GEMINI_API_KEY"] = key
    os.environ["GEMINI_API_KEY"] = key
    return {"status": "set", "message": "Gemini API key saved for this session."}


@router.get("/gemini-key")
def get_gemini_key_status():
    key = os.environ.get("GEMINI_API_KEY", "")
    return {
        "configured": bool(key),
        "key_preview": f"{key[:8]}...{key[-4:]}" if len(key) > 12 else ("set" if key else ""),
    }


@router.post("/gemini-key/test")
def test_gemini_key():
    """Quick test to verify the API key actually works."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return {"status": "error", "message": "No API key configured."}
    try:
        if key.startswith("sk-or-"):
            import requests
            resp = requests.post("https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": "google/gemini-2.0-flash-001", "messages": [{"role": "user", "content": "Reply with exactly: OK"}]})
            text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        else:
            from google import genai as genai_new
            client = genai_new.Client(api_key=key)
            resp = client.models.generate_content(
                model="gemini-2.0-flash",
                contents="Reply with exactly: OK"
            )
            text = resp.text.strip()
            
        if text:
            return {"status": "ok", "message": f"Gemini API key works! Response: {text[:30]}"}
        return {"status": "error", "message": "Empty response from Gemini."}
    except Exception as e:
        return {"status": "error", "message": str(e)[:200]}
