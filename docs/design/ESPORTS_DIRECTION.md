# Zen-Flow competitive client direction

The working version was preserved outside the project in `C:/Users/Asus/OneDrive/Desktop/zen-flow-backups/zen-flow-before-esports-redesign-20261009-172608.zip`. A SHA-256 manifest protects the backend and original NOVA artwork.

## The competitor and the decision

The first screen reads as a competitive client operated between matches. NOVA's original portrait anchors the left side; behavioral inference and its explanatory signals occupy the right. An actual squad comparison completes the story immediately below. The rating insignia displays the API's MMR; no invented rank tiers.

The previous screen's marketing slogan, equally weighted metric cards, tiny portrait and repeated rounded panel grid diluted its gaming identity. Replace those with compact client navigation, an inline queue status strip, a character identity surface, and tactical roster slots. The model lab remains a readable analyst view.

## Visual system

| Role                   | Token     |
| ---------------------- | --------- |
| Background             | `#0e1016` |
| Surface                | `#171922` |
| Primary text           | `#eeedf2` |
| Secondary text         | `#a1a3b5` |
| Selection / identity   | `#b7a4e2` |
| Primary action / trust | `#a4d7be` |

Risk uses restrained coral `#ee9b9e` with explicit scores and level labels. Barlow Condensed supplies player-name and broadcast hierarchy; Inter handles controls and descriptions. Fonts are self-hosted. Components use fine strokes, two-pixel corners, a clipped action corner, and selected-roster edges. Avoid fictional tactical ornaments and glows.

```
Brand       Overview / Matchmaking / Model lab       AI Gaming
Match control                                Simulation controls
Synthetic disclosure / queue status / scenario controls
NOVA character identity | Behavioral risk history
Rating / risk / stats   | Explained telemetry signals
Skill-only squad       → Recommended squad
Live telemetry           Chat classifier
Player queue
```

Motion confirms state: navigation selection, player switching, signal updates and a quiet live indicator. Reduced motion disables it. On phones the portrait, analysis, squad comparison and tools stack in reading order; full assignments have semantic headings.

## Functional boundaries

Preserve seeded sessions, simulation controls, selection, chat inference, risk filtering, chart history, model inspection, MMR constraints, recomputation and export. Backend, training, API contracts and NOVA artwork remain unchanged. Every roster and explanation consumes existing inference output. Recommendations never predict outcomes.

## Verification approach

Build and run existing Playwright behavior tests, then inspect desktop, tablet and phone browser captures. Check overflow, console errors, keyboard focus, reduced motion and composition controls. Browser plugin unavailable in this session; use repository Playwright. Keep QA captures and reports outside the repository.
