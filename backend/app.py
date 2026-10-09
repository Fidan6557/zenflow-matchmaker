from contextlib import asynccontextmanager
from dataclasses import dataclass
import logging
import os
from pathlib import Path
from threading import RLock
from time import monotonic
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from anyio import to_thread
from pydantic import BaseModel, ConfigDict, Field

from .matchmaking import recommend
from .ml import RiskModels
from .simulation import DemoSession


class Telemetry(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    click_rate_ratio: float = Field(ge=.3, le=4)
    click_irregularity: float = Field(ge=.02, le=1.8)
    mistake_rate: float = Field(ge=0, le=1)
    loss_streak: int = Field(ge=0, le=12)
    performance_drop: float = Field(ge=-.5, le=1)
    chat_risk: float = Field(ge=0, le=1)
    risk_trend: float = Field(ge=-.8, le=.8)
    session_minutes: int = Field(ge=1, le=240)


class CreateSession(BaseModel):
    seed: int = Field(default=2026, ge=0, le=2**32 - 1)


class Step(BaseModel):
    scenario: Literal["balanced", "pressure", "recovery"] = "balanced"
    player_id: str = "p00"


class Chat(BaseModel):
    player_id: str
    text: str = Field(min_length=1, max_length=500)


class MatchRequest(BaseModel):
    max_skill_gap: int = Field(default=50, ge=0, le=200)


@dataclass
class SessionEntry:
    session: DemoSession
    touched: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    artifact = Path(os.environ.get("ZEN_FLOW_MODEL_PATH", Path(__file__).parent / "artifacts" / "models.joblib"))
    required = os.environ.get("ZEN_FLOW_REQUIRE_ARTIFACT") == "1"
    if artifact.is_file():
        app.state.models = RiskModels.load(artifact)
        logging.getLogger("uvicorn.error").info("Loaded fitted models from %s (no training)", artifact)
    elif required:
        raise RuntimeError(f"Required fitted model artifact missing: {artifact}. Rebuild the Docker image.")
    else:
        app.state.models = RiskModels()
    app.state.frontend_dir = Path(os.environ.get("ZEN_FLOW_FRONTEND_DIST", Path(__file__).resolve().parent.parent / "dist")).resolve()
    if required and not (app.state.frontend_dir / "index.html").is_file():
        raise RuntimeError("Production frontend missing. Rebuild the Docker image.")
    # Bound thread stacks and native-library concurrency on the 512 MB instance.
    to_thread.current_default_thread_limiter().total_tokens = 4
    app.state.sessions = {}
    app.state.lock = RLock()
    yield
    app.state.sessions.clear()


app = FastAPI(title="Zen-Flow Matchmaker", version="1.0.0", lifespan=lifespan,
              description="Synthetic-data behavioral-risk and fair matchmaking MVP.")


def entry(session_id):
    result = app.state.sessions.get(session_id)
    if result is None or monotonic() - result.touched > 7200:
        app.state.sessions.pop(session_id, None)
        raise HTTPException(404, "Demo session expired or not found. Reload to create a new session.")
    result.touched = monotonic()
    return result.session


@app.get("/api/health")
def health():
    return {"status": "ok", "model": app.state.models.metadata["version"], "synthetic": True}


@app.get("/api/model")
def model():
    return app.state.models.metadata


@app.post("/api/predict")
def predict(body: Telemetry):
    return {**app.state.models.predict(body.model_dump()), "synthetic_model": True}


@app.post("/api/sessions", status_code=201)
def create_session(body: CreateSession):
    with app.state.lock:
        now = monotonic()
        for key in list(app.state.sessions):
            if now - app.state.sessions[key].touched > 7200:
                del app.state.sessions[key]
        if len(app.state.sessions) >= 100:
            raise HTTPException(503, "Demo session capacity reached. Try again later.")
        session_id = uuid4().hex
        session = DemoSession(app.state.models, body.seed)
        app.state.sessions[session_id] = SessionEntry(session, now)
        return {"session_id": session_id, **session.snapshot()}


@app.get("/api/sessions/{session_id}")
def snapshot(session_id: str):
    with app.state.lock:
        return entry(session_id).snapshot()


@app.post("/api/sessions/{session_id}/step")
def step(session_id: str, body: Step):
    with app.state.lock:
        session = entry(session_id)
        try:
            session.step(body.scenario, body.player_id)
        except KeyError:
            raise HTTPException(404, "Player not found")
        return session.snapshot()


@app.post("/api/sessions/{session_id}/reset")
def reset(session_id: str):
    with app.state.lock:
        session = entry(session_id)
        session.reset()
        return session.snapshot()


@app.post("/api/sessions/{session_id}/chat")
def chat(session_id: str, body: Chat):
    if not body.text.strip():
        raise HTTPException(422, "Chat message must contain visible text.")
    with app.state.lock:
        session = entry(session_id)
        try:
            analysis = session.chat(body.player_id, body.text.strip())
        except KeyError:
            raise HTTPException(404, "Player not found")
        return {"analysis": analysis, "snapshot": session.snapshot()}


@app.post("/api/sessions/{session_id}/matchmaking")
def matchmaking(session_id: str, body: MatchRequest):
    with app.state.lock:
        session = entry(session_id)
        return {**recommend(session.snapshot()["players"], body.max_skill_gap), "tick": session.tick}


# Register after every API endpoint. Missing API/asset paths must never return HTML.
@app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
async def frontend(path: str):
    if path == "api" or path.startswith("api/"):
        raise HTTPException(404, "API endpoint not found")
    root = app.state.frontend_dir
    candidate = (root / path).resolve()
    if not candidate.is_relative_to(root):
        raise HTTPException(404, "Not found")
    if candidate.is_file():
        cache = "public, max-age=31536000, immutable" if path.startswith("assets/") else "no-cache"
        return FileResponse(candidate, headers={"Cache-Control": cache})
    if Path(path).suffix or path == "assets" or path.startswith("assets/"):
        raise HTTPException(404, "Asset not found")
    index = root / "index.html"
    if not index.is_file():
        raise HTTPException(404, "Frontend not built. Run npm run build.")
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
