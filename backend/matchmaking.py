"""Exhaustive, transparent, skill-constrained team allocation."""

from itertools import combinations
from statistics import mean

TEAM_SIZE = 5


def evaluate_team(players):
    high = [p for p in players if p["risk"]["level"] == "High"]
    pairs = len(high) * (len(high) - 1) // 2
    trust_exposure = sum(mean(q["trust"] for q in players if q["id"] != p["id"]) for p in high)
    return {
        "players": players,
        "mean_mmr": round(mean(p["mmr"] for p in players), 1),
        "mean_trust": round(mean(p["trust"] for p in players), 1),
        "high_risk_count": len(high), "risk_pairs": pairs,
        "trust_exposure": trust_exposure,
    }


def partitions(lobby):
    # Anchor first player in A to remove equivalent A/B permutations.
    for rest in combinations(range(1, 10), TEAM_SIZE - 1):
        indices = {0, *rest}
        a = evaluate_team([p for i, p in enumerate(lobby) if i in indices])
        b = evaluate_team([p for i, p in enumerate(lobby) if i not in indices])
        yield {"teams": [a, b], "skill_gap": round(abs(a["mean_mmr"] - b["mean_mmr"]), 1),
               "risk_pairs": a["risk_pairs"] + b["risk_pairs"],
               "trust_exposure": a["trust_exposure"] + b["trust_exposure"]}


def summarize(matches):
    return {"matches": matches, "risk_pairs": sum(m["risk_pairs"] for m in matches),
            "max_skill_gap": max(m["skill_gap"] for m in matches),
            "average_skill_gap": round(mean(m["skill_gap"] for m in matches), 1)}


def recommend(players, max_skill_gap: int = 50):
    if len(players) != 20 or len({p["id"] for p in players}) != 20:
        raise ValueError("Exactly twenty distinct players are required.")
    ordered = sorted(players, key=lambda p: (-p["mmr"], p["id"]))
    before, after, explanations = [], [], []
    for index in range(2):
        lobby = ordered[index * 10:(index + 1) * 10]
        options = list(partitions(lobby))
        baseline = min(options, key=lambda x: x["skill_gap"])
        feasible = [x for x in options if x["skill_gap"] <= max_skill_gap]
        fallback = not feasible
        candidate = min(feasible, key=lambda x: (x["risk_pairs"], -x["trust_exposure"], x["skill_gap"])) if feasible else baseline
        for selection, target in [(baseline, before), (candidate, after)]:
            target.append({**selection, "lobby": index + 1, "cap_met": selection["skill_gap"] <= max_skill_gap})
        unavoidable = candidate["risk_pairs"] > 0
        explanations.append({
            "lobby": index + 1,
            "text": f"Lobby {index + 1}: {baseline['risk_pairs']} → {candidate['risk_pairs']} high-risk teammate pairs. "
                    f"Mean team skill gap {candidate['skill_gap']:g} MMR (limit {max_skill_gap}). "
                    "The same ten players stay in this skill lobby.",
            "constraint_warning": "No partition meets the limit; used the smallest achievable skill gap." if fallback else None,
            "tradeoff": "Some high-risk pairing remains unavoidable at the best feasible split." if unavoidable else "No high-risk players share a team in this split.",
        })
    return {"baseline": summarize(before), "optimized": summarize(after), "explanations": explanations,
            "max_skill_gap": max_skill_gap, "partitions_evaluated": 252,
            "policy": "Minimize high-risk pairs → maximize teammate trust around high-risk players → minimize skill gap, within fixed skill lobbies and the MMR cap.",
            "outcome_policy": "No skill ratings or match results are changed. No win probability or outcome is promised.",
            "synthetic": True}
