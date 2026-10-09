# Zen-Flow Matchmaker

A working AI Gaming hackathon MVP: simulated gameplay telemetry → learned behavioral-risk inference → transparent, skill-constrained team recommendations.

**Synthetic telemetry. Real ML inference. No claims about player emotions.** Nothing here demonstrates reduced toxicity, churn, or improved real-world competitive outcomes.

## Run locally

Requirements: Node 22+, Python 3.12. No API keys, paid services, or game accounts.

```powershell
# Install once, from the project root
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
npm ci

# Start both local servers in the background
.\scripts\start.ps1
```

Open **http://127.0.0.1:5173**. API documentation: **http://127.0.0.1:8000/docs**.

If PowerShell blocks local scripts, use two terminals instead:

```powershell
# Terminal 1
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000

# Terminal 2
npm run dev
```

`scripts/start.ps1` writes local process records and logs under `.zen-flow/`. `scripts/stop.ps1` stops only the processes started by that script. Servers started in your terminal stop with Ctrl+C. Both bind to loopback only.

For Linux/macOS, replace `.venv\Scripts\python.exe` with `.venv/bin/python`; the npm commands are the same.

## Three-minute judge demo

1. **Overview:** point out the simulated-environment disclosure, 20 seeded players and NOVA's inferred risk. Click different players; the chart, profile and explanations follow the selection.
2. **Recovery:** select Recovery window, then Start simulation. After about eight windows, NOVA's risk drops. Pause. This is a controlled change in generated telemetry, **not evidence that an intervention works**.
3. **Chat intelligence:** choose Toxic → Analyze message, then Supportive → Analyze message. The learned classifier shows class probabilities and changes the rolling chat signal. Test your own phrasing too; the small English corpus has obvious limitations.
4. **Reset → Compare teams:** inspect the skill-only baseline and Zen-Flow recommendations. At seed 2026 and the default 50 MMR cap, the optimizer reduces co-located high-risk pairs. It can use part of the allowed MMR gap; the real before/after gaps are displayed. Tighten the cap to zero and recompute to see the tradeoff. Each roster stays within its original skill lobby.
5. **Model lab:** inspect held-out evaluation, training sizes, coefficient magnitudes, confusion matrix and limitations. Export a matchmaking decision as JSON for inspection.

## What is actually implemented

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind 4 design tokens, Recharts; responsive charcoal/mint esports UI |
| Behavioral ML | scikit-learn StandardScaler + LogisticRegression, eight telemetry features, 3,600 generated windows across 600 synthetic identities |
| NLP | Word + character TF-IDF + three-class LogisticRegression; 144 hand-authored English templates with five name variants each |
| Evaluation | 450 training / 150 held-out telemetry identities; 108 training / 36 held-out chat template groups |
| Explanations | Exact additive model log-odds contributions relative to a low-risk training reference, with raw observed features |
| Matchmaking | All 126 unique five-versus-five partitions per fixed ten-player skill lobby; 252 total candidates |
| Integration | FastAPI authoritative per-session state; real HTTP requests for simulation, inference, chat and recommendations |
| Reproducibility | Seed 2026, dataset fingerprint, Python and npm lock files, deterministic reset, exportable evaluations and decisions |

Risk bands are policy: **Low <35; Medium 35–<65; High ≥65**. Scores are model probability ×100 against the synthetic target; they are not validated estimates of a real player's emotions. The numerical score determines the band before rounding for display.

Chat risk is `P(toxic) + 0.45 × P(frustrated)`. New messages update the recent chat feature using an explicit exponentially weighted average. Seed chat messages also pass through the classifier. Telemetry uses click-rate ratios relative to each player's generated baseline, click-interval irregularity, mistake rate, loss streak, performance drop, chat risk, recent behavioral feature trend and session duration.

The allocator sorts the queue into two fixed skill lobbies, then optimizes lexicographically:

1. Respect the maximum difference between **mean** team MMRs.
2. Minimize high-risk teammate pairs.
3. Maximize mean teammate trust around high-risk players.
4. Minimize MMR difference among remaining equal candidates.

If no split satisfies the cap, it returns the smallest possible skill gap and discloses that exception. Trust scores are simulated historical behavior. They remain fixed during the demo; teammates are not expected to manage another player's behavior. There are no rating changes, outcome predictions, secret handicaps, or manufactured wins.

## Verification

```powershell
# Backend model, algorithm and API checks
.\.venv\Scripts\python.exe -m pytest backend/tests -q

# Reproduce evaluation metadata in backend/artifacts/evaluation.json
.\.venv\Scripts\python.exe -m backend.train

# TypeScript and production bundle
npm run build

# With both servers running, install the test browser once and exercise the UI
npx playwright install chromium
npm run test:e2e

# Optional: production preview, while FastAPI remains running
npm run preview
```

Browser tests cover page identity, loaded chart/avatar, console health, desktop/mobile overflow, live simulation and pause, recovery and exact reset, NLP ingestion, filters and player selection, MMR recomputation, JSON download, model lab and visible API failures. Test artifacts go to the OS temporary directory, outside source control.

The competitive-client redesign adds a character-led NOVA profile, live behavioral analysis, and squad composition slots. Responsive checks cover 375, 390, 768, 1024, 1440 and 1536px, including long player names, keyboard focus and reduced motion. The art-direction proposal is in [docs/design/ESPORTS_DIRECTION.md](docs/design/ESPORTS_DIRECTION.md). The original backend, simulation and NOVA artwork are preserved.

## API map

- `GET /api/health` and `GET /api/model`
- `POST /api/predict` — eight validated telemetry features
- `POST /api/sessions` — optional `seed`
- `GET /api/sessions/{id}`
- `POST /api/sessions/{id}/step` — `scenario`: balanced / pressure / recovery, `player_id`
- `POST /api/sessions/{id}/reset`
- `POST /api/sessions/{id}/chat` — `player_id`, `text` (1–500 characters)
- `POST /api/sessions/{id}/matchmaking` — `max_skill_gap` (0–200)

Sessions are isolated, bounded to 100, expire after two idle hours, and are in memory. A page reload creates a fresh seeded session. A server restart discards sessions. There is no database, authentication or durable telemetry collection in this local MVP.

## Evidence boundaries and next steps

Synthetic labels encode generator assumptions. Template-family separation prevents identical template variants from leaking, but the authored corpus still has closely related phrasing and does not represent language in the wild. The high toy-corpus score should not be presented as moderation accuracy.

The allocator uses average MMR, not a validated game-specific fairness model. Roles are shown for context but role quotas, parties, geography, latency and queue times are not enforced. Recommended future work: opt-in real telemetry, independently annotated behavior targets, diverse multilingual evaluation, calibration and false-positive review, privacy/retention controls, role/party-aware assignment, and a transparent controlled field study.

## Project map

```text
backend/ml.py                  Synthetic training, NLP, inference, explanations
backend/simulation.py          Independent seeded sessions and event history
backend/matchmaking.py         Exhaustive constrained allocation
backend/app.py                 FastAPI routes, validation and session lifecycle
backend/tests/test_system.py   Model, allocator, simulation and API tests
src/useDemo.ts                 HTTP integration and non-overlapping simulation
src/components/Overview.tsx    Risk chart, profile, signals, queue and chat probe
src/components/Matchmaking.tsx Baseline/recommendation comparison and export
src/components/ModelLab.tsx    Evaluation, model weights and evidence limits
tests/demo.spec.ts             Playwright interaction tests
docs/IMPLEMENTATION_PLAN.md    Architecture, implementation plan and contracts
docs/design/concept.png        Image-generated primary-screen design reference
```

The original UI concept and NOVA avatar were created with the built-in Image Gen workflow. The current competitive-client interface is implemented in React and CSS, preserving the original NOVA art. Avatar art is fictional, not a player photograph. Original prompts are recorded in [docs/design/PROMPTS.md](docs/design/PROMPTS.md).

Implementation references: [scikit-learn LogisticRegression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html), [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/), [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite).
