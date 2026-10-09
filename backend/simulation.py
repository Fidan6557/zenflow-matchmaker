"""Per-session deterministic telemetry, with bounded event and inference history."""

from __future__ import annotations

from collections import deque
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from statistics import mean

import numpy as np

from .ml import RiskModels

NAMES = ["NOVA", "SPECTRE", "VEX", "SAGE", "ECHO", "ONYX", "AURORA", "KAIZEN", "FLUX", "ATLAS",
         "RIFT", "PIXEL", "KODA", "ZENITH", "LYRA", "EMBER", "AXIOM", "NEON", "ORBIT", "SOL"]
ROLES = ["Duelist", "Initiator", "Controller", "Sentinel", "Support"]
COLORS = ["violet", "blue", "coral", "mint", "amber"]
CHAT = {
    "pressure": ["I keep losing every round", "my teammates are trash", "I am losing patience", "nothing is working for me"],
    "recovery": ["let us regroup at mid", "nice shot team", "we can still win this", "no worries we learn"],
    "balanced": ["good game everyone", "saving for next round", "I cannot hit a shot today", "I can cover you team"],
}


class DemoSession:
    def __init__(self, models: RiskModels, seed: int):
        self.models = models
        self.seed = seed
        self.reset()

    def reset(self):
        self.rng = np.random.default_rng(self.seed)
        self.tick = 0
        self.event_sequence = 0
        self.events = deque(maxlen=100)
        self.history = deque(maxlen=60)
        self.players = []
        self.base_time = datetime(2026, 10, 9, 12, 0, tzinfo=timezone.utc)
        # An independent seeded rating stream avoids coupling MMR to behavior.
        ratings = np.random.default_rng(self.seed)
        for i, name in enumerate(NAMES):
            stress = [.91, .85, .8, .16, .23, .19, .32, .25, .41, .18,
                      .88, .77, .2, .26, .16, .35, .22, .44, .18, .3][i]
            mmr = int(round(ratings.normal(1850 if i < 10 else 1600, 65) / 5) * 5)
            seed_message = "my teammates are trash" if stress > .7 else "I keep losing every round" if stress > .4 else "nice shot team"
            seed_chat = self.models.analyze_chat(seed_message)
            player = {"id": f"p{i:02d}", "name": name, "role": ROLES[i % 5], "color": COLORS[i % 5],
                      "mmr": 1850 if i == 0 else mmr, "trust": int(self.rng.integers(58, 76) if stress > .7 else self.rng.integers(84, 99)),
                      "baseline_cpm": int(self.rng.integers(90, 145)), "baseline_kd": round(float(self.rng.uniform(1.1, 1.8)), 2),
                      "win_rate": int(self.rng.integers(42, 68)), "matches": int(self.rng.integers(80, 420)),
                      "stress": stress, "history": [], "recent_chat": [{"text": seed_message, **seed_chat}], "features": self.features_for(stress, 0)}
            player["features"]["chat_risk"] = seed_chat["risk"]
            player["risk"] = self.models.predict(player["features"])
            self.players.append(player)
        # Seed 12 genuinely inferred historical windows, not random chart points.
        for tick in range(12):
            for player in self.players:
                stress = float(np.clip(player["stress"] - .13 * (11 - tick) / 11 + self.rng.normal(0, .025), .05, .97))
                features = self.features_for(stress, tick)
                features["chat_risk"] = player["features"]["chat_risk"]
                risk = self.models.predict(features)
                player["history"].append({"tick": tick, "score": risk["score"]})
                if tick == 11:
                    player["features"], player["risk"] = features, risk
            self.record_history(tick)
        self.tick = 11
        for player in self.players[:5]:
            self.add_event(player, "Performance", f"Baseline captured · {player['mmr']:,} MMR · {player['role']}", "info")
        self.add_event(self.players[0], "Mouse", f"Click rate {self.players[0]['features']['click_rate_ratio']:.2f}× personal baseline", "warning")
        self.add_event(self.players[0], "Chat", self.players[0]["recent_chat"][0]["text"], "warning", self.players[0]["recent_chat"][0])

    def features_for(self, stress, tick):
        rng = self.rng
        return {
            "click_rate_ratio": round(float(np.clip(.9 + stress * 1.45 + rng.normal(0, .08), .3, 4)), 3),
            "click_irregularity": round(float(np.clip(.12 + stress * .8 + rng.normal(0, .04), .02, 1.8)), 3),
            "mistake_rate": round(float(np.clip(.03 + stress * .42 + rng.normal(0, .03), 0, 1)), 3),
            "loss_streak": min(12, int(stress * 6)),
            "performance_drop": round(float(np.clip(.04 + stress * .6 + rng.normal(0, .04), -.5, 1)), 3),
            "chat_risk": round(float(np.clip(stress ** 1.8 + rng.normal(0, .04), 0, 1)), 3),
            "risk_trend": round(float(np.clip(stress * .7 - .18 + rng.normal(0, .05), -.8, .8)), 3),
            "session_minutes": min(240, 28 + tick),
        }

    def add_event(self, player, category, text, severity="info", chat=None):
        timestamp = self.base_time + timedelta(seconds=self.tick * 15)
        self.event_sequence += 1
        self.events.appendleft({"id": f"event-{self.event_sequence}", "tick": self.tick,
                                "time": timestamp.isoformat(), "player_id": player["id"], "player": player["name"],
                                "category": category, "text": text, "severity": severity, "chat": chat})

    def record_history(self, tick):
        self.history.append({"tick": tick, "time": f"+{tick * 15}s",
                             "average": round(mean(p["history"][-1]["score"] for p in self.players), 1),
                             "selected": self.players[0]["history"][-1]["score"]})

    def step(self, scenario="balanced", selected_id="p00"):
        selected = self.player(selected_id)  # Validate before any mutation.
        self.tick += 1
        for player in self.players:
            previous = player["features"]
            delta = (.075 if scenario == "pressure" else -.085 if scenario == "recovery" else float(self.rng.normal(0, .025)))
            # Pressure/recovery target the selected player, not the whole queue.
            if player is not selected:
                delta = float(self.rng.normal(0, .015))
            player["stress"] = float(np.clip(player["stress"] + delta, .02, .98))
            features = self.features_for(player["stress"], self.tick)
            # Smooth learned chat signal until new messages arrive.
            features["chat_risk"] = round(.75 * previous["chat_risk"] + .25 * features["chat_risk"], 4)
            player["features"] = features
            player["risk"] = self.models.predict(features)
            player["history"] = (player["history"] + [{"tick": self.tick, "score": player["risk"]["score"]}])[-60:]
        if self.tick % 2 == 0:
            self.chat(selected_id, str(self.rng.choice(CHAT[scenario])), record_history=False)
        self.add_event(selected, "Mouse", f"{round(selected['baseline_cpm'] * selected['features']['click_rate_ratio'])} clicks/min · {selected['features']['click_irregularity']:.2f} interval variation", "warning" if selected["risk"]["level"] == "High" else "info")
        self.add_event(selected, "Performance", f"{selected['features']['loss_streak']} consecutive losses · performance {selected['features']['performance_drop']:.0%} below baseline", "warning" if selected["risk"]["level"] == "High" else "info")
        self.record_history(self.tick)

    def player(self, player_id):
        for player in self.players:
            if player["id"] == player_id:
                return player
        raise KeyError(player_id)

    def chat(self, player_id, text, record_history=True):
        player = self.player(player_id)
        result = self.models.analyze_chat(text)
        # A new message influences the rolling signal; it never defines risk alone.
        player["features"]["chat_risk"] = round(.4 * player["features"]["chat_risk"] + .6 * result["risk"], 4)
        player["risk"] = self.models.predict(player["features"])
        player["recent_chat"] = ([{"text": text, **result}] + player["recent_chat"])[:6]
        player["history"][-1]["score"] = player["risk"]["score"]
        if record_history:
            self.history[-1]["average"] = round(mean(p["risk"]["score"] for p in self.players), 1)
            self.history[-1]["selected"] = self.players[0]["risk"]["score"]
        self.add_event(player, "Chat", text, "warning" if result["risk"] >= .5 else "info", result)
        return result

    def snapshot(self):
        players = [{k: deepcopy(v) for k, v in player.items() if k != "stress"} for player in self.players]
        return {"seed": self.seed, "tick": self.tick, "synthetic": True, "players": players,
                "events": list(self.events), "history": list(self.history),
                "stats": {"players": len(players), "high_risk": sum(p["risk"]["level"] == "High" for p in players),
                          "average_trust": round(mean(p["trust"] for p in players)),
                          "average_risk": round(mean(p["risk"]["score"] for p in players), 1)}}
