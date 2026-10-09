"""Reproducible synthetic models. No real-world emotion or outcome claims."""

from __future__ import annotations

import hashlib
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, make_pipeline
from sklearn.preprocessing import StandardScaler

SEED = 2026
FEATURES = [
    "click_rate_ratio", "click_irregularity", "mistake_rate", "loss_streak",
    "performance_drop", "chat_risk", "risk_trend", "session_minutes",
]
FEATURE_LABELS = {
    "click_rate_ratio": "Click-rate shift",
    "click_irregularity": "Irregular click intervals",
    "mistake_rate": "Repeated mistakes",
    "loss_streak": "Consecutive losses",
    "performance_drop": "Performance decline",
    "chat_risk": "Chat risk",
    "risk_trend": "Behavioral escalation",
    "session_minutes": "Session duration",
}

# Template families are the evaluation unit. Variants of one sentence cannot leak
# into both train and test. Deliberately modest English-only synthetic corpus.
CHAT_TEMPLATES = {
    "neutral": [
        "nice shot {name}", "good game everyone", "let us regroup at mid",
        "I can cover you {name}", "thanks for the help", "we can still win this",
        "hold the angle and wait", "I will play support", "great teamwork team",
        "saving for next round", "my ultimate is ready", "rotate to the other site",
        "no worries we learn", "that was a good try", "please do not blame the team",
        "you are not useless", "let us keep chat respectful", "I made a mistake sorry",
        "need some help here", "well played {name}", "taking a short break after this",
        "we have time to reset", "let us focus on the next round", "all good team",
        "nice aim well played", "good shot nice work", "nice shot and great teamwork",
        "great shot friend", "well played good round", "good luck have fun everyone",
        "thanks team that was great", "great cover I appreciate it", "good job on the objective",
        "nice work holding the angle", "happy to help the team", "let us coordinate our next move",
        "we played well together", "good communication everyone", "nice one thanks for the assist",
        "great effort we will get the next one", "you played that well", "thanks for covering mid",
        "I have your back friend", "nice try that was close", "good call let us rotate",
        "we can regroup and try again", "great teamwork nice round", "that was fun thanks team",
    ],
    "frustrated": [
        "I keep losing every round", "nothing is working for me", "I am so frustrated",
        "I cannot hit a shot today", "this is getting annoying", "I need a break now",
        "why do I keep making mistakes", "another loss this is exhausting",
        "I am struggling to focus", "my aim feels terrible today", "I am losing patience",
        "that round was so frustrating", "I cannot believe we lost again",
        "I am playing badly right now", "this match is wearing me out",
        "I feel stuck after all these losses", "I am annoyed with my own mistakes",
        "I do not want to queue again", "so many losses in a row",
        "I am tired of missing everything", "I should stop for a moment",
        "this is really getting to me", "I am tilted by my own aim",
        "I need to reset before another round",
        "I am frustrated with my aim", "I keep missing shots and losing rounds",
        "I am frustrated after losing again", "I feel annoyed after this loss",
        "I am struggling with repeated mistakes", "another frustrating round for me",
        "I need a pause because I cannot focus", "losing this much is exhausting",
        "my mistakes are making me frustrated", "I am tired and losing focus",
        "I missed again and I am annoyed", "I need to step away for a bit",
        "this losing streak is frustrating", "my performance is dropping today",
        "I am disappointed in my last round", "I keep making the same mistake",
        "my aim is off and I need a break", "I am frustrated but trying to focus",
        "I am having a rough session", "I am upset with how I am playing",
        "I am finding this match exhausting", "I cannot focus after so many losses",
        "my hands feel tired from playing", "I wish I could stop making mistakes",
    ],
    "toxic": [
        "you are useless {name}", "shut up you idiot", "uninstall the game loser",
        "my teammates are trash", "you ruined the whole match", "stop feeding moron",
        "you are the worst player ever", "nobody wants you on this team",
        "stupid team cannot do anything", "you suck at this game {name}",
        "garbage players all of you", "I hate this worthless team",
        "get out of my lobby noob", "you are pathetic at this game",
        "absolute trash team again", "you idiots threw the round",
        "stop talking loser", "report this useless player",
        "you have no brain {name}", "dumb teammates wasting my time",
        "this team is full of morons", "you are completely worthless",
        "quit playing you garbage noob", "you are a stupid feeder",
        "you are trash and useless", "useless teammate you ruined this",
        "you are a complete idiot", "trash team full of idiots",
        "you morons are ruining the game", "shut up you useless noob",
        "stupid loser learn to play", "you are garbage at aiming",
        "your stupid mistakes ruined everything", "useless player uninstall now",
        "noob team you all suck", "you are an idiot and a feeder",
        "trash teammate go away", "you dumb loser stop playing",
        "you pathetic noob ruined it", "shut up nobody likes you",
        "you are worthless and stupid", "I hate playing with you idiots",
        "you are a brainless feeder", "garbage team stop wasting my time",
        "you useless moron lost us the game", "stop feeding you trash player",
        "worst teammates ever uninstall", "you idiots cannot aim at all",
    ],
}


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -40, 40)))


def generate_telemetry(seed: int = SEED, players: int = 600):
    """Six correlated windows per identity; targets sampled from latent risk.

    The latent target is not computed from a hard-coded feature-score threshold.
    Features are noisy manifestations of latent stress, with player nuisance
    variation. This still reflects simulator assumptions, not field evidence.
    """
    rng = np.random.default_rng(seed)
    groups = np.repeat(np.arange(players), 6)
    baseline = rng.normal(0, 0.25, players)[groups]
    latent = np.clip(rng.beta(1.6, 1.8, players * 6) + baseline * 0.15, 0, 1)
    click = np.clip(0.9 + 1.45 * latent + baseline + rng.normal(0, .23, len(groups)), .3, 4)
    cv = np.clip(.12 + .8 * latent + rng.normal(0, .16, len(groups)), .02, 1.8)
    mistakes = np.clip(.03 + .42 * latent + rng.normal(0, .08, len(groups)), 0, 1)
    losses = np.clip(rng.poisson(.3 + 4.2 * latent), 0, 12)
    drop = np.clip(.04 + .6 * latent + rng.normal(0, .15, len(groups)), -.5, 1)
    chat = np.clip(latent ** 1.8 + rng.normal(0, .21, len(groups)), 0, 1)
    trend = np.clip(.7 * latent - .18 + rng.normal(0, .18, len(groups)), -.8, .8)
    minutes = np.clip(rng.normal(35 + latent * 42, 22, len(groups)), 1, 240)
    X = np.column_stack([click, cv, mistakes, losses, drop, chat, trend, minutes])
    y = rng.binomial(1, sigmoid((latent - .54) * 9 + rng.normal(0, .45, len(groups))))
    return X, y, groups


class RiskModels:
    def __init__(self):
        # Evaluation-only modules and arrays are not needed when loading inference artifacts.
        from sklearn.metrics import brier_score_loss, confusion_matrix, f1_score, roc_auc_score
        from sklearn.model_selection import GroupShuffleSplit

        self.chat, chat_metrics = self._train_chat()
        X, y, groups = generate_telemetry()
        train, test = next(GroupShuffleSplit(n_splits=1, test_size=.25, random_state=SEED).split(X, y, groups))
        self.model = make_pipeline(StandardScaler(), LogisticRegression(C=.6, max_iter=1000, random_state=SEED))
        self.model.fit(X[train], y[train])
        probabilities = self.model.predict_proba(X[test])[:, 1]
        pred = probabilities >= .5
        self.reference = X[train][y[train] == 0].mean(axis=0)
        self.train_groups = set(groups[train].tolist())
        self.test_groups = set(groups[test].tolist())
        scaler, classifier = self.model.steps[0][1], self.model.steps[1][1]
        weight = np.abs(classifier.coef_[0])
        digest = hashlib.sha256(X.tobytes() + y.tobytes()).hexdigest()[:12]
        self.metadata = {
            "version": "zen-synthetic-v1", "seed": SEED, "dataset_fingerprint": digest,
            "algorithm": "StandardScaler + LogisticRegression",
            "nlp_algorithm": "Word + character TF-IDF / LogisticRegression (3 classes)",
            "data_source": "Synthetic telemetry and hand-authored English chat templates",
            "train_windows": len(train), "test_windows": len(test),
            "train_players": len(self.train_groups), "test_players": len(self.test_groups),
            "split": "Held-out player identities; held-out chat template families",
            "roc_auc": round(float(roc_auc_score(y[test], probabilities)), 4),
            "f1": round(float(f1_score(y[test], pred)), 4),
            "brier_score": round(float(brier_score_loss(y[test], probabilities)), 4),
            "confusion_matrix": confusion_matrix(y[test], pred).tolist(),
            "nlp": chat_metrics,
            "features": [{"name": f, "label": FEATURE_LABELS[f], "importance": round(float(w / weight.sum()), 4)} for f, w in zip(FEATURES, weight)],
            "thresholds": {"low_below": 35, "high_at": 65},
            "limitations": [
                "Synthetic labels encode generator assumptions; these scores are not real-world accuracy.",
                "Risk is a behavioral estimate, not an observation of a player's emotions.",
                "English-only toy NLP; sarcasm, quoted insults, dialect and unseen phrasing may be misclassified.",
                "Trust is simulated historical behavior, not a measurement of personality.",
                "No demonstrated reduction in toxicity, churn or unfair outcomes.",
                "An opt-in production study and independent validation are required before deployment.",
            ],
        }
        self.baseline_score = float(self.model.predict_proba([self.reference])[0, 1] * 100)

    def save(self, path: Path):
        """Export fitted inference state; no training data is retained in the bundle."""
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        state = {key: getattr(self, key) for key in
                 ("model", "chat", "reference", "baseline_score", "metadata")}
        joblib.dump({"format": 1, "features": FEATURES,
                     "versions": {"sklearn": sklearn.__version__, "numpy": np.__version__},
                     "state": state}, path, compress=3)

    @classmethod
    def load(cls, path: Path):
        """Load only the trusted artifact produced by our own build, without fitting."""
        bundle = joblib.load(path)
        versions = {"sklearn": sklearn.__version__, "numpy": np.__version__}
        if bundle.get("format") != 1 or bundle.get("features") != FEATURES or bundle.get("versions") != versions:
            raise RuntimeError("Incompatible model artifact. Rebuild with the locked Python dependencies.")
        models = cls.__new__(cls)
        models.__dict__.update(bundle["state"])
        return models

    def _train_chat(self):
        from sklearn.metrics import accuracy_score, confusion_matrix, f1_score

        train_text, train_y, test_text, test_y = [], [], [], []
        self.chat_train_templates, self.chat_test_templates = set(), set()
        names = ("nova", "ace", "team", "friend", "player")
        for label, templates in CHAT_TEMPLATES.items():
            rng = np.random.default_rng(SEED)
            held_out = set(rng.choice(len(templates), len(templates) // 4, replace=False).tolist())
            for index, template in enumerate(templates):
                is_test = index in held_out
                (self.chat_test_templates if is_test else self.chat_train_templates).add(template)
                for name in names:
                    text = template.format(name=name)
                    (test_text if is_test else train_text).append(text)
                    (test_y if is_test else train_y).append(label)
        model = make_pipeline(
            FeatureUnion([
                ("word", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)),
                ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True)),
            ]),
            LogisticRegression(C=5, max_iter=1000, random_state=SEED),
        )
        model.fit(train_text, train_y)
        pred = model.predict(test_text)
        metrics = {"train_messages": len(train_text), "test_messages": len(test_text),
                   "train_templates": len(self.chat_train_templates), "test_templates": len(self.chat_test_templates),
                   "accuracy": round(float(accuracy_score(test_y, pred)), 4),
                   "macro_f1": round(float(f1_score(test_y, pred, average="macro")), 4),
                   "classes": model.classes_.tolist(),
                   "confusion_matrix": confusion_matrix(test_y, pred, labels=model.classes_).tolist()}
        return model, metrics

    def analyze_chat(self, text: str):
        if not text.strip():
            return {"label": "neutral", "risk": 0.0, "probabilities": {"neutral": 1.0, "frustrated": 0.0, "toxic": 0.0}}
        probabilities = dict(zip(self.chat.classes_, self.chat.predict_proba([text])[0]))
        return {"label": max(probabilities, key=probabilities.get),
                "risk": round(float(probabilities["toxic"] + .45 * probabilities["frustrated"]), 4),
                "probabilities": {k: round(float(v), 4) for k, v in probabilities.items()}}

    def predict(self, features: dict):
        row = np.array([features[f] for f in FEATURES], dtype=float)
        score = float(self.model.predict_proba([row])[0, 1] * 100)
        scaler, classifier = self.model.steps[0][1], self.model.steps[1][1]
        contributions = (row - self.reference) / scaler.scale_ * classifier.coef_[0]
        signals = []
        for feature, value, contribution in zip(FEATURES, row, contributions):
            signals.append({"feature": feature, "label": FEATURE_LABELS[feature],
                            "value": round(float(value), 4), "contribution": round(float(contribution), 4),
                            "direction": "raises" if contribution > 0 else "lowers",
                            "explanation": self.describe(feature, float(value))})
        signals.sort(key=lambda s: abs(s["contribution"]), reverse=True)
        return {"score": round(score, 1), "level": "High" if score >= 65 else "Medium" if score >= 35 else "Low",
                "signals": signals, "reference_score": round(self.baseline_score, 1),
                "explanation_method": "Exact additive log-odds contributions relative to the low-risk training reference; not causal effects."}

    @staticmethod
    def describe(feature, value):
        descriptions = {
            "click_rate_ratio": f"Click frequency is {value:.2f}× this player's baseline.",
            "click_irregularity": f"Click interval coefficient of variation: {value:.2f}.",
            "mistake_rate": f"{value:.0%} of recent actions are simulated mistakes.",
            "loss_streak": f"{int(value)} consecutive simulated losses.",
            "performance_drop": f"Performance is {abs(value):.0%} {'below' if value >= 0 else 'above'} baseline.",
            "chat_risk": f"Recent learned NLP risk estimate: {value:.0%}.",
            "risk_trend": f"Recent behavioral feature trend: {value:+.2f}.",
            "session_minutes": f"{int(value)} minutes in this synthetic session.",
        }
        return descriptions[feature]
