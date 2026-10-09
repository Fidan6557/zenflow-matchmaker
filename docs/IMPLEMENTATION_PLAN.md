# Zen-Flow Matchmaker

## System architecture

React 19 + TypeScript + Vite + Tailwind 4 + Recharts → same-origin `/api` proxy → FastAPI → in-memory, per-demo sessions → scikit-learn inference → constrained team assignment.

No external AI service, credentials, or real player data are required. The demo is local and deliberately session-scoped: refresh resets the session unless the client still retains its session ID. Sessions expire and are bounded to avoid unbounded memory use.

### ML contract

1. Seeded synthetic telemetry uses latent behavioral stress, player-specific baselines, overlapping distributions, and stochastic labels. Those labels represent a **simulated behavioral-risk target**, not observed emotions.
2. Split telemetry by synthetic player identity, never by individual windows. Fit a standardization + logistic-regression pipeline on the training identities only. Report held-out ROC-AUC, F1, Brier score and confusion matrix.
3. Train a separate word/character TF-IDF + logistic-regression classifier on hand-authored neutral, frustrated, and toxic chat templates. Hold out entire template families, not generated message variants. Chat risk is P(toxic) + 0.45 × P(frustrated).
4. Risk explanations are exact additive contributions to the telemetry classifier's log odds relative to a low-risk training reference. They explain the model, not causation. Risk thresholds are product policy: <35 Low, <65 Medium, otherwise High.
5. Evaluation on generated data demonstrates code behavior only. Real validity, calibration, language coverage, consent, moderation review, privacy and deployment outcomes remain untested.

### Matchmaking contract

Twenty players form two fixed ten-player skill lobbies, then four teams of five. Exhaustively evaluate all 126 unique partitions per lobby. The skill-only baseline minimizes mean team MMR difference. Zen-Flow first minimizes co-located high-risk pairs, then improves the trust of teammates around high-risk players, then minimizes skill difference, subject to the configured MMR gap. No roster swaps between lobbies, skill rating changes, outcome predictions, or hidden wins/losses. If the cap is infeasible, use the minimum-gap split and disclose the exception.

Player MMRs vary using a separate seeded normal-distribution stream. The demo exposes actual before/after skill gaps: behavioral redistribution can use some of the explicitly allowed gap. It does not claim an identical gap for both allocations.

### API

- `GET /api/health`, `GET /api/model`: health and evaluation/model metadata.
- `POST /api/sessions`: create seeded independent demo; `GET /api/sessions/{id}`: snapshot.
- `POST /api/sessions/{id}/step`: advance telemetry (balanced, pressure, recovery scenarios).
- `POST /api/sessions/{id}/reset`: deterministic reset; `POST /api/sessions/{id}/chat`: analyze and incorporate a message for the selected player.
- `POST /api/sessions/{id}/matchmaking`: compare baseline and constrained recommendations.
- `POST /api/predict`: validate and infer caller-provided telemetry.

The browser advances the simulation with a single non-overlapping request every 1.6 seconds. Events and histories are bounded. Server data is authoritative; browser controls show pending/error states.

## Build sequence and acceptance checks

1. Model and seeded generator: fit both classifiers, produce reproducible evaluation, test risk ordering and chat contrast, ensure disjoint train/test groups.
2. Matchmaking: exhaustive constraint checks, same-roster/team-size invariants, no duplicate players, infeasible-cap disclosure.
3. API: validated schemas, per-session isolation, reproducible reset, event ingestion and error handling tests.
4. UI: reusable app shell, overview, player roster/spotlight, risk chart, event feed, chat probe, team comparison and model lab. Concept-first charcoal/mint/lavender esports style; mobile and reduced-motion support.
5. Build/typecheck, backend tests, browser workflow tests and desktop/mobile visual comparison. Keep actual tests in source; temporary screenshots and diagnostic reports outside the project.

## Design tokens and component inventory

- Background #0c0d14; sidebar #10111b; panels #141620; borders #282a39.
- Foreground #eeedf5; muted #9293aa; mint #8df5bb; lavender #bba6ff; coral #ff8c8f; amber #f3c67a.
- Space Grotesk headings / Inter body / monospace data; 12px panel corners; 1px outlines; 24–32px section gaps.
- Sidebar navigation, workspace header, main title/actions, synthetic disclosure, four-column stats, chart/spotlight split, feed/signals split, matchmaking preview.
- Controls: run/pause, single step, scenario selector, reset, player selector, roster filter, chat analysis, MMR limit, recompute, model details, JSON export.
- Intentional extensions to primary concept: full matchmaking and model-lab views, chat probe, accessible status/error UI and compact single-step/scenario controls are required to demonstrate the requested working system.
