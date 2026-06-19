"""
Auth router — signup, login, JWT.
"""
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.database import get_db, User
from backend.models.schemas import SignupRequest, LoginRequest, TokenResponse

router = APIRouter()

SECRET_KEY = os.environ.get("SECRET_KEY", "trusteval-secret-key-change-in-prod")


def hash_password(password: str) -> str:
    salt = "trusteval_salt"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def create_token(user_id: int, email: str) -> str:
    import base64, json, time
    payload = {"user_id": user_id, "email": email, "exp": time.time() + 86400 * 7}
    token_data = base64.b64encode(json.dumps(payload).encode()).decode()
    return f"te_{token_data}"


def decode_token(token: str) -> dict:
    import base64, json, time
    try:
        if not token.startswith("te_"):
            raise ValueError("Invalid token prefix")
        data = json.loads(base64.b64decode(token[3:]).decode())
        if data["exp"] < time.time():
            raise ValueError("Token expired")
        return data
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user(authorization: str = "", db: Session = Depends(get_db)):
    from fastapi import Header
    raise HTTPException(status_code=401, detail="Not implemented as dependency — use manually")


@router.post("/signup", response_model=TokenResponse)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        name=body.name,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.email)
    return TokenResponse(access_token=token, user_name=user.name, user_email=user.email)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.hashed_password != hash_password(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user.id, user.email)
    return TokenResponse(access_token=token, user_name=user.name, user_email=user.email)


@router.get("/me")
def get_me(authorization: str = "", db: Session = Depends(get_db)):
    token = authorization.replace("Bearer ", "").replace("bearer ", "")
    payload = decode_token(token)
    user = db.query(User).filter(User.email == payload["email"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": user.id, "name": user.name, "email": user.email}
