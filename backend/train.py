"""Build-time/offline export of fitted models and reproducible evaluation."""
import json
from pathlib import Path

from .ml import RiskModels

if __name__ == "__main__":
    models = RiskModels()
    output = Path(__file__).parent / "artifacts" / "evaluation.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(models.metadata, indent=2), encoding="utf-8")
    artifact = output.with_name("models.joblib")
    models.save(artifact)
    print(f"Saved fitted models to {artifact}")
    print(json.dumps(models.metadata, indent=2))
