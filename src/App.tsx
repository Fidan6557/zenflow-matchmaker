import { lazy, Suspense, useState } from "react";
import {
  ChevronRight,
  CircleAlert,
  FlaskConical,
  Info,
  LayoutGrid,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Users,
  Wifi,
} from "lucide-react";
import Overview from "./components/Overview";
import { Logo } from "./components/ui";
import { useDemo } from "./useDemo";
import type { Scenario, View } from "./types";

const Matchmaking = lazy(() => import("./components/Matchmaking"));
const ModelLab = lazy(() => import("./components/ModelLab"));
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "matchmaking", label: "Matchmaking", icon: Users },
  { id: "models", label: "Model lab", icon: FlaskConical },
] as const;

export default function App() {
  const [view, setView] = useState<View>("overview");
  const demo = useDemo();
  const { data, models, matches } = demo;
  const player = data?.players.find((p) => p.id === demo.selectedId);
  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const ready = !!(data && models && matches && player);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="Zen-Flow home"
        >
          <Logo />
          <strong>Zen-Flow</strong>
          <span>Matchmaker</span>
        </button>
        <nav aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-label={label}
              title={label}
              className={view === id ? "active" : ""}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {view === id ? (
                <ChevronRight size={14} className="nav-chevron" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="client-edition">
          <span className="dot violet-dot" />
          AI Gaming <span>Hackathon build</span>
        </div>
      </aside>
      <div className="workspace">
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="workspace-label">
                Competitive intelligence <span>/</span>{" "}
                {view === "overview"
                  ? "Live overview"
                  : view === "matchmaking"
                    ? "Team composition"
                    : "Model inspection"}
              </div>
              <h1>
                {view === "overview"
                  ? "Match control"
                  : view === "matchmaking"
                    ? "A fairer next game."
                    : "Inside the intelligence."}
              </h1>
              <p>
                {view === "overview"
                  ? "Read the signals. Preserve the competition."
                  : view === "matchmaking"
                    ? "Explainable team composition. Competitive integrity intact."
                    : "Inspect the models, the data, and the evidence boundaries."}
              </p>
            </div>
            <div className="primary-actions">
              <button
                className="button primary"
                disabled={!ready || (demo.busy && !demo.running)}
                onClick={() => demo.setRunning((v) => !v)}
              >
                {demo.running ? <Pause size={17} /> : <Play size={17} />}
                {demo.running ? "Pause simulation" : "Start simulation"}
              </button>
              <button
                className="button secondary reset-button"
                aria-label="Reset"
                disabled={!ready || demo.busy}
                onClick={() => void demo.reset()}
              >
                <RotateCcw size={17} />
                <span>Reset</span>
              </button>
            </div>
          </div>
          <div className="simulation-banner">
            <Info size={17} />
            <strong>SIMULATED ENVIRONMENT</strong>
            <span>
              Synthetic telemetry. Real ML inference. No claims about player
              emotions.
            </span>
          </div>
          {demo.error ? (
            <div className="error-banner" role="alert">
              <CircleAlert size={18} />
              <span>{demo.error}</span>
              <button onClick={data ? () => void demo.reset() : demo.retry}>
                {data ? "Reconnect" : "Retry connection"}
              </button>
            </div>
          ) : null}
          {!ready ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={30} />
              <h2>Preparing the matchmaker</h2>
              <p>Connecting to FastAPI and fitting the seeded classifiers…</p>
              <code>Backend: http://127.0.0.1:8000</code>
            </div>
          ) : (
            <>
              <div className="queue-status">
                <span>
                  <Users size={15} />
                  <strong>{data.stats.players}</strong> players in queue
                </span>
                <span>
                  <i className="dot coral-dot" />
                  <strong className="coral-text">
                    {data.stats.high_risk}
                  </strong>{" "}
                  high-risk signals
                </span>
                <span>
                  Average trust{" "}
                  <strong>
                    {data.stats.average_trust}
                    <small>/100</small>
                  </strong>
                </span>
                <span className="integrity-status">
                  <ShieldCheck size={15} />
                  Skill gap limit <strong>{matches.max_skill_gap} MMR</strong>
                </span>
              </div>
              <div className="simulation-toolbar">
                <div className="scenario-control">
                  <label htmlFor="scenario">Scenario</label>
                  <select
                    id="scenario"
                    value={demo.scenario}
                    onChange={(e) =>
                      demo.setScenario(e.target.value as Scenario)
                    }
                  >
                    <option value="balanced">Balanced session</option>
                    <option value="pressure">Pressure ramp</option>
                    <option value="recovery">Recovery window</option>
                  </select>
                  <span>
                    targets <strong>{player.name}</strong>
                  </span>
                </div>
                <div className="simulation-state">
                  <span className={demo.running ? "live-label" : ""}>
                    <i
                      className={`dot ${demo.running ? "mint-dot" : "muted-dot"}`}
                    />
                    {demo.running ? "Live simulation" : "Simulation paused"}
                  </span>
                  <button
                    className="step-button"
                    onClick={() => void demo.step()}
                    disabled={demo.busy || demo.running}
                  >
                    <SkipForward size={14} />
                    Step +15s
                  </button>
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="loading-state">
                    <LoaderCircle className="spin" />
                  </div>
                }
              >
                {view === "overview" ? (
                  <Overview
                    data={data}
                    player={player}
                    matches={matches}
                    busy={demo.busy}
                    onSelect={demo.setSelectedId}
                    onCompare={() => navigate("matchmaking")}
                    onChat={demo.sendChat}
                  />
                ) : view === "matchmaking" ? (
                  <Matchmaking
                    result={matches}
                    player={player}
                    selectedId={demo.selectedId}
                    onSelect={demo.setSelectedId}
                    limit={demo.limit}
                    onLimit={demo.setLimit}
                    onRecompute={() => void demo.recompute()}
                    busy={demo.busy}
                  />
                ) : (
                  <ModelLab model={models} />
                )}
              </Suspense>
              <footer className="app-footer">
                <span>
                  <Wifi size={13} />
                  Local FastAPI connected{" "}
                  <span className="footer-divider">/</span> {models.version}
                </span>
                <span className="mono">
                  Seed {data.seed} · Window {data.tick} · Synthetic demo
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
