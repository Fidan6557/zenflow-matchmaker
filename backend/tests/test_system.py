from copy import deepcopy

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.matchmaking import recommend
from backend.ml import FEATURES, RiskModels, generate_telemetry, sigmoid
from backend.simulation import DemoSession


@pytest.fixture(scope="module")
def models():
    return RiskModels()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_generator_reproducible_and_player_holdout(models):
    one, two = generate_telemetry(), generate_telemetry()
    assert all(np.array_equal(a, b) for a, b in zip(one, two))
    assert not models.train_groups & models.test_groups
    assert not models.chat_train_templates & models.chat_test_templates
    assert models.metadata["test_players"] == 150
    assert .65 < models.metadata["roc_auc"] < 1


def test_classifier_orders_behavior_and_explains_exact_log_odds(models):
    calm = dict(zip(FEATURES, [1, .15, .03, 0, .02, .02, -.15, 30]))
    pressure = dict(zip(FEATURES, [2.5, 1, .5, 6, .7, .85, .5, 80]))
    low, high = models.predict(calm), models.predict(pressure)
    assert low["level"] == "Low"
    assert high["level"] == "High"
    reference = models.baseline_score / 100
    reconstructed = sigmoid(np.log(reference / (1 - reference)) + sum(s["contribution"] for s in high["signals"]))
    assert abs(reconstructed * 100 - high["score"]) < .1


def test_nlp_learned_contrast_and_probability_distribution(models):
    neutral = models.analyze_chat("nice shot team")
    toxic = models.analyze_chat("you are useless and my teammates are trash")
    frustrated = models.analyze_chat("I keep losing every round")
    assert toxic["label"] == "toxic"
    assert neutral["label"] == "neutral"
    assert frustrated["label"] == "frustrated"
    assert toxic["risk"] > frustrated["risk"] > neutral["risk"]
    assert abs(sum(toxic["probabilities"].values()) - 1) < .001


def test_simulation_reset_is_exact_and_pressure_recovery_respond(models):
    session = DemoSession(models, 2026)
    original = session.snapshot()
    for _ in range(8):
        session.step("recovery")
    recovered = session.player("p00")["risk"]["score"]
    assert recovered < original["players"][0]["risk"]["score"] - 30
    for _ in range(10):
        session.step("pressure")
    assert session.player("p00")["risk"]["score"] > recovered + 30
    session.reset()
    assert session.snapshot() == original


@pytest.mark.parametrize("seed", [0, 7, 2026, 998])
@pytest.mark.parametrize("cap", [0, 50, 100])
def test_matchmaking_preserves_rosters_and_constraints(models, seed, cap):
    session = DemoSession(models, seed)
    players = session.snapshot()["players"]
    # Distinct MMR values verify the allocator beyond demo's tied seed ratings.
    for index, player in enumerate(players):
        player["mmr"] += index * 3
    original = deepcopy(players)
    result = recommend(players, cap)
    assert players == original
    for before, after in zip(result["baseline"]["matches"], result["optimized"]["matches"]):
        roster = lambda match: {p["id"] for team in match["teams"] for p in team["players"]}
        assert roster(before) == roster(after)
        assert len(roster(after)) == 10
        assert all(len(t["players"]) == 5 for t in after["teams"])
        if after["cap_met"]:
            assert after["skill_gap"] <= cap
        else:
            assert after["skill_gap"] == before["skill_gap"]
            assert result["explanations"][after["lobby"] - 1]["constraint_warning"]
        assert after["risk_pairs"] <= before["risk_pairs"]


def test_seeded_matchmaking_improves_behavioral_distribution(models):
    result = recommend(DemoSession(models, 2026).snapshot()["players"], 50)
    assert result["optimized"]["risk_pairs"] < result["baseline"]["risk_pairs"]
    assert result["optimized"]["max_skill_gap"] <= 50


def test_api_end_to_end_session_isolation_validation_and_chat(client):
    created = client.post("/api/sessions", json={"seed": 2026})
    assert created.status_code == 201
    original = created.json()
    sid = original["session_id"]
    other = client.post("/api/sessions", json={"seed": 2026}).json()["session_id"]
    step = client.post(f"/api/sessions/{sid}/step", json={"scenario": "recovery", "player_id": "p00"})
    assert step.status_code == 200 and step.json()["tick"] == original["tick"] + 1
    assert client.get(f"/api/sessions/{other}").json()["tick"] == original["tick"]
    chat = client.post(f"/api/sessions/{sid}/chat", json={"player_id": "p00", "text": "my teammates are trash"})
    assert chat.json()["analysis"]["label"] == "toxic"
    assert chat.json()["snapshot"]["players"][0]["recent_chat"][0]["text"] == "my teammates are trash"
    assert client.post(f"/api/sessions/{sid}/chat", json={"player_id": "p00", "text": "   "}).status_code == 422
    assert client.post(f"/api/sessions/{sid}/step", json={"scenario": "invalid"}).status_code == 422
    assert client.post(f"/api/sessions/{sid}/matchmaking", json={"max_skill_gap": -1}).status_code == 422
    assert client.get("/api/sessions/unknown").status_code == 404
    tick = client.get(f"/api/sessions/{sid}").json()["tick"]
    assert client.post(f"/api/sessions/{sid}/step", json={"player_id": "missing"}).status_code == 404
    assert client.get(f"/api/sessions/{sid}").json()["tick"] == tick
    result = client.post(f"/api/sessions/{sid}/matchmaking", json={"max_skill_gap": 50}).json()
    assert result["partitions_evaluated"] == 252
    reset = client.post(f"/api/sessions/{sid}/reset").json()
    assert reset["players"] == original["players"]
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/model").json()["test_windows"] == 900


def test_api_rejects_out_of_range_and_unknown_prediction_features(client):
    assert client.post("/api/predict", json={"chat_risk": 2}).status_code == 422
    features = dict(zip(FEATURES, [1, .15, .03, 0, .02, .02, -.15, 30]))
    response = client.post("/api/predict", json=features)
    assert response.status_code == 200 and response.json()["level"] == "Low"
    assert client.post("/api/predict", json={**features, "secret": 2}).status_code == 422


def test_repeated_chat_events_have_unique_ids(models):
    session = DemoSession(models, 2026)
    for _ in range(105):
        session.chat("p00", "good game everyone")
    ids = [e["id"] for e in session.snapshot()["events"]]
    assert len(ids) == len(set(ids))
