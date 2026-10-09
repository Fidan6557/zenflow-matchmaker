"""Production artifact loading, same-origin SPA serving and one-worker startup."""
from pathlib import Path

import joblib
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.ml import RiskModels
from backend.simulation import DemoSession


@pytest.fixture(scope="module")
def fitted():
    return RiskModels()


@pytest.fixture
def production(tmp_path, monkeypatch, fitted):
    artifact = tmp_path / "models.joblib"
    fitted.save(artifact)
    frontend = tmp_path / "dist"
    (frontend / "assets").mkdir(parents=True)
    (frontend / "index.html").write_text("<!doctype html><title>Zen-Flow Matchmaker</title>")
    (frontend / "assets" / "app-test.js").write_text("console.log('production')")
    (frontend / "nova-avatar.png").write_bytes(b"fixture-avatar")
    monkeypatch.setenv("ZEN_FLOW_REQUIRE_ARTIFACT", "1")
    monkeypatch.setenv("ZEN_FLOW_MODEL_PATH", str(artifact))
    monkeypatch.setenv("ZEN_FLOW_FRONTEND_DIST", str(frontend))
    return artifact, frontend


def test_artifact_round_trip_preserves_inference_and_seeded_simulation(fitted, tmp_path, monkeypatch):
    artifact = tmp_path / "models.joblib"
    fitted.save(artifact)
    expected = DemoSession(fitted, 2026).snapshot()
    monkeypatch.setattr(RiskModels, "__init__", lambda self: pytest.fail("Loading must never train"))
    loaded = RiskModels.load(artifact)
    assert loaded.metadata == fitted.metadata
    assert DemoSession(loaded, 2026).snapshot() == expected
    for message in ("nice shot team", "my teammates are trash", "I keep losing every round"):
        assert loaded.analyze_chat(message) == fitted.analyze_chat(message)


def test_production_serves_spa_assets_health_and_original_api_without_training(production, monkeypatch):
    monkeypatch.setattr(RiskModels, "__init__", lambda self: pytest.fail("Production must never train"))
    with TestClient(app) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        for path in ("/", "/matchmaking", "/analysis/player/nova"):
            response = client.get(path)
            assert response.status_code == 200
            assert "text/html" in response.headers["content-type"]
            assert "Zen-Flow Matchmaker" in response.text
            assert response.headers["cache-control"] == "no-cache"
        assert client.head("/").content == b""
        asset = client.get("/assets/app-test.js")
        assert asset.status_code == 200 and "production" in asset.text
        assert "immutable" in asset.headers["cache-control"]
        assert client.get("/nova-avatar.png").content == b"fixture-avatar"
        for path in ("/api", "/api/missing", "/assets/missing.js", "/missing.png", "/%2E%2E%2Fbackend%2Fml.py"):
            response = client.get(path)
            assert response.status_code == 404
            assert response.headers["content-type"] == "application/json"
        created = client.post("/api/sessions", json={"seed": 2026}).json()
        sid = created["session_id"]
        step = client.post(f"/api/sessions/{sid}/step", json={"scenario": "recovery"})
        assert step.json()["tick"] == created["tick"] + 1
        chat = client.post(f"/api/sessions/{sid}/chat", json={"player_id": "p00", "text": "my teammates are trash"})
        assert chat.json()["analysis"]["label"] == "toxic"
        result = client.post(f"/api/sessions/{sid}/matchmaking", json={"max_skill_gap": 0}).json()
        assert result["max_skill_gap"] == 0
        assert result["optimized"]["max_skill_gap"] == 0


def test_production_fails_fast_if_model_artifact_is_missing(production):
    artifact, _ = production
    artifact.unlink()
    with pytest.raises(RuntimeError, match="Required fitted model artifact missing"):
        with TestClient(app):
            pass


def test_production_fails_fast_if_frontend_is_missing(production):
    _, frontend = production
    (frontend / "index.html").unlink()
    with pytest.raises(RuntimeError, match="Production frontend missing"):
        with TestClient(app):
            pass


def test_artifact_rejects_incompatible_dependency_versions(fitted, tmp_path):
    artifact = tmp_path / "models.joblib"
    fitted.save(artifact)
    bundle = joblib.load(artifact)
    bundle["versions"]["sklearn"] = "incompatible"
    joblib.dump(bundle, artifact)
    with pytest.raises(RuntimeError, match="Incompatible model artifact"):
        RiskModels.load(artifact)


def test_production_entrypoint_uses_port_all_interfaces_and_one_worker(monkeypatch):
    import uvicorn
    from backend.serve import main

    calls = []
    monkeypatch.setenv("PORT", "12345")
    monkeypatch.setattr(uvicorn, "run", lambda *args, **kwargs: calls.append((args, kwargs)))
    main()
    assert calls == [(("backend.app:app",), {"host": "0.0.0.0", "port": 12345, "workers": 1})]
