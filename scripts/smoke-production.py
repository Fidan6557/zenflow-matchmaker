"""Verify a running container or Render URL using only Python's standard library."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="Base URL, e.g. http://127.0.0.1:10000")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    def fetch(path, body=None):
        request = Request(base + path, data=None if body is None else json.dumps(body).encode(),
                          headers={} if body is None else {"Content-Type": "application/json"})
        with urlopen(request, timeout=90) as response:
            return response.read(), response.headers

    def api(path, body=None):
        payload, _ = fetch("/api" + path, body)
        return json.loads(payload)

    assert api("/health")["status"] == "ok"
    html, headers = fetch("/")
    assert "text/html" in headers["content-type"] and b"Zen-Flow Matchmaker" in html
    assets = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', html.decode())
    assert assets, "Frontend build assets not linked"
    for asset in assets:
        assert fetch(asset)[0], f"Empty asset: {asset}"
    avatar = fetch("/nova-avatar.png")[0]
    original = Path(__file__).resolve().parent.parent / "public" / "nova-avatar.png"
    assert hashlib.sha256(avatar).digest() == hashlib.sha256(original.read_bytes()).digest()
    assert fetch("/matchmaking")[0] == html, "SPA refresh did not return index.html"
    created = api("/sessions", {"seed": 2026})
    sid, initial = created["session_id"], created["tick"]
    stepped = api(f"/sessions/{sid}/step", {"scenario": "recovery", "player_id": "p00"})
    assert stepped["tick"] == initial + 1
    chat = api(f"/sessions/{sid}/chat", {"player_id": "p00", "text": "my teammates are trash"})
    assert chat["analysis"]["label"] == "toxic"
    for cap in (50, 0):
        result = api(f"/sessions/{sid}/matchmaking", {"max_skill_gap": cap})
        assert result["max_skill_gap"] == cap
        assert result["optimized"]["max_skill_gap"] <= cap
        assert result["partitions_evaluated"] == 252
        assigned = [p["id"] for m in result["optimized"]["matches"] for t in m["teams"] for p in t["players"]]
        assert sorted(assigned) == sorted(p["id"] for p in created["players"])
    assert api(f"/sessions/{sid}/reset", {})["players"] == created["players"]
    print(json.dumps({"url": base, "health": "passed", "frontend_assets": len(assets),
                      "original_nova": "passed", "spa_refresh": "passed", "simulation": "passed",
                      "chat": "passed", "matchmaking_50_and_0_mmr": "passed", "reset": "passed"}))


if __name__ == "__main__":
    main()
