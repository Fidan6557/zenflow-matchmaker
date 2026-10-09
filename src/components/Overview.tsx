import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  CornerDownLeft,
  MessageSquare,
  Mouse,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChatAnalysis, MatchResult, Player, Snapshot } from "../types";
import { Avatar, Panel, RiskBadge, RiskRing } from "./ui";

const tooltipStyle = {
  background: "#1b1d2a",
  border: "1px solid #35374c",
  borderRadius: 2,
  color: "#eeedf5",
  fontSize: 12,
};
const CATEGORIES = ["All", "Mouse", "Performance", "Chat"] as const;

function RiskChart({ data, player }: { data: Snapshot; player: Player }) {
  const points = useMemo(() => {
    const scores = new Map(player.history.map((h) => [h.tick, h.score]));
    return data.history.map((h) => ({ ...h, player: scores.get(h.tick) }));
  }, [data.history, player.history]);
  return (
    <Panel
      title="Behavioral risk over time"
      icon={Activity}
      className="chart-panel"
      action={
        <div className="chart-legend">
          <span>
            <i className="dot mint-dot" />
            {player.name}
          </span>
          <span>
            <i className="dot violet-dot" />
            Queue average
          </span>
        </div>
      }
    >
      <div className="chart-context">
        <strong>{player.name}</strong>
        <span>Selected player / rolling behavioral estimate</span>
        <RiskBadge level={player.risk.level} />
      </div>
      <div
        className="risk-chart"
        role="img"
        aria-label={`Risk history for ${player.name}. Current score ${Math.round(player.risk.score)} out of 100. High risk begins at 65.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 15, right: 12, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a4d7be" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#a4d7be" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#2b2d3c"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="tick"
              tickFormatter={(v) => `+${v * 15}s`}
              minTickGap={40}
              stroke="#525468"
              tick={{ fill: "#a1a3b5", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              stroke="#525468"
              tick={{ fill: "#a1a3b5", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={65}
              stroke="#ff8c8f"
              strokeDasharray="4 6"
              strokeOpacity={0.3}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(v) => `Simulated time +${Number(v) * 15}s`}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} / 100`,
                name === "player" ? player.name : "Queue average",
              ]}
            />
            <Area
              dataKey="player"
              type="monotone"
              fill="url(#riskGradient)"
              stroke="#a4d7be"
              strokeWidth={2.5}
              isAnimationActive={false}
            />
            <Line
              dataKey="average"
              type="monotone"
              stroke="#ab99d4"
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-foot">
        <span>15-second synthetic windows</span>
        <span className="mono">High ≥65 · Medium ≥35 · Low &lt;35</span>
      </div>
    </Panel>
  );
}

function Spotlight({
  player,
  players,
  onSelect,
}: {
  player: Player;
  players: Player[];
  onSelect: (id: string) => void;
}) {
  return (
    <Panel
      title="Player spotlight"
      icon={Users}
      className="spotlight"
      action={
        <label className="select-player">
          <span className="sr-only">Select player</span>
          <select
            aria-label="Select player"
            value={player.id}
            onChange={(e) => onSelect(e.target.value)}
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
      }
    >
      <div
        className={`profile-main ${player.id === "p00" ? "character-profile" : "initials-profile"}`}
        key={player.id}
      >
        <Avatar player={player} large />
        <div className="profile-topline">
          <span>Selected competitor</span>
          <span className="rating-mark">
            <ShieldCheck size={16} />
            {player.mmr.toLocaleString()} MMR
          </span>
        </div>
        <div
          className={`profile-identity ${player.name.length > 5 ? "long-name" : ""}`}
        >
          <span className="player-role">{player.role}</span>
          <h3>{player.name}</h3>
          <p>Simulated player profile</p>
        </div>
        <div className="profile-risk">
          <span>Behavioral risk</span>
          <RiskRing score={player.risk.score} level={player.risk.level} />
          <RiskBadge level={player.risk.level} />
        </div>
      </div>
      <div className="player-stats">
        <div>
          <span>Behavioral trust</span>
          <strong className="mint-text">
            {player.trust}
            <small>/100</small>
          </strong>
        </div>
        <div>
          <span>Win rate</span>
          <strong>
            {player.win_rate}
            <small>%</small>
          </strong>
        </div>
        <div>
          <span>Matches</span>
          <strong>{player.matches}</strong>
        </div>
      </div>
      <div className="performance-strip">
        <span>
          <Mouse size={11} />
          {Math.round(
            player.baseline_cpm * player.features.click_rate_ratio,
          )}{" "}
          clicks/min
        </span>
        <span>
          Est. K/D{" "}
          <strong>
            {(
              player.baseline_kd *
              (1 - player.features.performance_drop)
            ).toFixed(2)}
          </strong>
          <small>baseline {player.baseline_kd.toFixed(2)}</small>
        </span>
      </div>
      <p className="fine-print">Behavioral estimate, not an emotion reading.</p>
    </Panel>
  );
}

function Signals({ player }: { player: Player }) {
  const max = Math.max(
    ...player.risk.signals.map((s) => Math.abs(s.contribution)),
    1,
  );
  return (
    <Panel title="Detected signals" icon={BarChart3} className="signals-panel">
      <div className="signals-list">
        {player.risk.signals.slice(0, 3).map((signal, index) => (
          <div className="signal-row" key={signal.feature}>
            <div className="signal-label">
              <span>{signal.label}</span>
              <span
                className={`mono ${signal.direction === "raises" ? "coral-text" : "mint-text"}`}
              >
                {signal.contribution > 0 ? "+" : ""}
                {signal.contribution.toFixed(2)}
              </span>
            </div>
            <div className="signal-track">
              <span
                className={
                  signal.direction === "lowers"
                    ? "mint-bar"
                    : index === 1
                      ? "violet-bar"
                      : "coral-bar"
                }
                style={{
                  width: `${Math.max(3, (Math.abs(signal.contribution) / max) * 100)}%`,
                }}
              />
            </div>
            <p>{signal.explanation}</p>
          </div>
        ))}
      </div>
      <details className="signal-details">
        <summary>How the model explains this</summary>
        <p>
          {player.risk.explanation_method} Reference risk:{" "}
          {player.risk.reference_score}%.
        </p>
        {player.risk.signals.slice(3).map((s) => (
          <p key={s.feature}>
            {s.label}:{" "}
            <span className="mono">
              {s.contribution > 0 ? "+" : ""}
              {s.contribution.toFixed(2)}
            </span>{" "}
            · {s.direction} model risk
          </p>
        ))}
      </details>
    </Panel>
  );
}

function EventFeed({ data }: { data: Snapshot }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const events =
    category === "All"
      ? data.events
      : data.events.filter((e) => e.category === category);
  return (
    <Panel
      title="Live telemetry"
      icon={ClipboardList}
      className="feed-panel"
      action={
        <div className="filter-tabs" aria-label="Telemetry category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      }
    >
      <div className="event-feed" data-testid="event-feed">
        {events.length ? (
          events.slice(0, 30).map((event) => {
            const Icon =
              event.category === "Mouse"
                ? Mouse
                : event.category === "Chat"
                  ? MessageSquare
                  : BarChart3;
            return (
              <div className="event-row" key={event.id}>
                <time className="mono">+{event.tick * 15}s</time>
                <i
                  className={`dot ${event.severity === "warning" ? "coral-dot" : "mint-dot"}`}
                />
                <Icon size={15} aria-hidden="true" />
                <span className="event-player">{event.player}</span>
                <span className="event-text">
                  {event.text}
                  {event.chat ? (
                    <small>
                      {" "}
                      · {event.chat.label} ({Math.round(event.chat.risk * 100)}%
                      risk)
                    </small>
                  ) : null}
                </span>
              </div>
            );
          })
        ) : (
          <div className="empty-feed">
            <MessageSquare size={22} />
            <p>No {category.toLowerCase()} events yet.</p>
            <span>Step the simulation or analyze a chat message.</span>
          </div>
        )}
      </div>
      <div className="feed-foot">
        <span>
          <i className="dot mint-dot" />
          FastAPI → scikit-learn → live inference
        </span>
        <span className="mono" data-testid="tick">
          Window {data.tick}
        </span>
      </div>
    </Panel>
  );
}

function Preview({
  matches,
  playerId,
  onCompare,
}: {
  matches: MatchResult;
  playerId: string;
  onCompare: () => void;
}) {
  const teamFor = (assignment: MatchResult["baseline"]) =>
    assignment.matches
      .flatMap((m) => m.teams)
      .find((t) => t.players.some((p) => p.id === playerId))!;
  return (
    <Panel
      title="Matchmaking preview"
      icon={Users}
      className="match-preview"
      action={
        <button className="text-button" onClick={onCompare}>
          Compare teams <ArrowRight size={15} />
        </button>
      }
    >
      <div className="preview-comparison">
        {[matches.baseline, matches.optimized].map((assignment, i) => (
          <div className="preview-side" key={i}>
            <div className="preview-label">
              <strong className={i ? "mint-text" : ""}>
                {i ? "Recommended squad" : "Skill-only squad"}
              </strong>
              <span>
                Team trust{" "}
                <strong>{teamFor(assignment).mean_trust.toFixed(1)}</strong>
                <small>
                  {assignment.risk_pairs} high-risk pairs across queue
                </small>
              </span>
            </div>
            <div className="preview-players">
              {teamFor(assignment).players.map((p) => (
                <div
                  className={`squad-slot ${p.id === playerId ? "selected" : ""} ${p.risk.level.toLowerCase()}`}
                  key={p.id}
                >
                  <div className="squad-identity">
                    <Avatar player={p} />
                    <span
                      className={`slot-risk risk-number ${p.risk.level.toLowerCase()}`}
                    >
                      {Math.round(p.risk.score)}
                      <small>risk</small>
                    </span>
                  </div>
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                  <small className="mono">{p.mmr.toLocaleString()} MMR</small>
                </div>
              ))}
            </div>
          </div>
        ))}
        <ArrowRight className="preview-arrow" size={28} />
      </div>
      <div className="preview-foot">
        <ShieldCheck size={14} />
        <span>
          Same skill lobby. Visible constraints. No outcome manipulation.
        </span>
        <span className="mono">
          Max gap {matches.optimized.max_skill_gap} MMR
        </span>
      </div>
    </Panel>
  );
}

export function PlayerQueue({
  players,
  selectedId,
  onSelect,
}: {
  players: Player[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState("All");
  const filtered =
    filter === "All" ? players : players.filter((p) => p.risk.level === filter);
  return (
    <Panel
      title="Player queue"
      icon={Users}
      action={
        <select
          aria-label="Filter players by risk"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
      }
    >
      <div className="queue-table">
        <div className="queue-head">
          <span>PLAYER</span>
          <span>MMR</span>
          <span>TRUST</span>
          <span>RISK</span>
        </div>
        {filtered.length ? (
          filtered.map((p) => (
            <button
              key={p.id}
              className={`queue-row ${selectedId === p.id ? "selected" : ""}`}
              onClick={() => onSelect(p.id)}
              aria-label={`View ${p.name}`}
              aria-pressed={selectedId === p.id}
            >
              <span className="queue-name">
                <Avatar player={p} />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.role}</small>
                </span>
              </span>
              <span className="mono">{p.mmr.toLocaleString()}</span>
              <span className="mono mint-text">{p.trust}</span>
              <span
                className={`mono risk-number ${p.risk.level.toLowerCase()}`}
              >
                {p.risk.score.toFixed(0)}
                <span className="sr-only"> {p.risk.level} risk</span>
              </span>
            </button>
          ))
        ) : (
          <div className="empty-feed">
            <p>No players at {filter.toLowerCase()} risk.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ChatProbe({
  player,
  busy,
  onSend,
}: {
  player: Player;
  busy: boolean;
  onSend: (text: string) => Promise<ChatAnalysis | undefined>;
}) {
  const [text, setText] = useState("We can regroup and try again.");
  const [result, setResult] = useState<{
    analysis: ChatAnalysis;
    player: string;
    text: string;
  } | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    const message = text.trim(),
      name = player.name;
    const analysis = await onSend(message);
    if (analysis) setResult({ analysis, player: name, text: message });
  };
  return (
    <Panel
      title="Chat intelligence"
      icon={MessageSquare}
      className="chat-probe"
      action={<span className="subtle-label">Learned NLP</span>}
    >
      <p className="panel-description">
        Try a message for <strong>{player.name}</strong>. The classifier updates
        their rolling chat signal.
      </p>
      <div className="chat-presets">
        <button onClick={() => setText("nice shot team")}>Supportive</button>
        <button onClick={() => setText("I keep losing every round")}>
          Frustrated
        </button>
        <button onClick={() => setText("my teammates are trash")}>Toxic</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="chat-message">
          Chat message
        </label>
        <textarea
          id="chat-message"
          maxLength={500}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a simulated chat message…"
          rows={3}
        />
        <div className="chat-form-footer">
          <span className="mono">{text.length}/500</span>
          <button
            className="button primary small"
            type="submit"
            disabled={busy || !text.trim()}
          >
            Analyze message <CornerDownLeft size={14} />
          </button>
        </div>
      </form>
      {result ? (
        <div className="chat-result" role="status" data-testid="chat-result">
          <div>
            <Check size={15} />
            <strong>
              {result.player}: {result.analysis.label}
            </strong>
            <span className="mono">
              {Math.round(result.analysis.risk * 100)}% chat risk
            </span>
          </div>
          <p>“{result.text}”</p>
          {Object.entries(result.analysis.probabilities).map(
            ([label, probability]) => (
              <div className="probability" key={label}>
                <span>{label}</span>
                <div>
                  <i style={{ width: `${probability * 100}%` }} />
                </div>
                <span className="mono">{Math.round(probability * 100)}%</span>
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="nlp-note">
          <ShieldCheck size={16} />
          <p>
            English-only synthetic training corpus. Context and sarcasm may be
            misclassified; this is not an emotion detector.
          </p>
        </div>
      )}
    </Panel>
  );
}

export default function Overview({
  data,
  player,
  matches,
  busy,
  onSelect,
  onCompare,
  onChat,
}: {
  data: Snapshot;
  player: Player;
  matches: MatchResult;
  busy: boolean;
  onSelect: (id: string) => void;
  onCompare: () => void;
  onChat: (text: string) => Promise<ChatAnalysis | undefined>;
}) {
  return (
    <>
      <div className="overview-grid">
        <Spotlight player={player} players={data.players} onSelect={onSelect} />
        <div className="analysis-stack">
          <RiskChart data={data} player={player} />
          <Signals player={player} />
        </div>
      </div>
      <Preview matches={matches} playerId={player.id} onCompare={onCompare} />
      <div className="operations-grid">
        <EventFeed data={data} />
        <ChatProbe
          key={player.id}
          player={player}
          busy={busy}
          onSend={onChat}
        />
      </div>
      <PlayerQueue
        players={data.players}
        selectedId={player.id}
        onSelect={onSelect}
      />
    </>
  );
}
