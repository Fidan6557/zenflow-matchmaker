import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import type { Match, MatchResult, Player, Team } from "../types";
import { Avatar, Panel } from "./ui";

function TeamList({
  team,
  label,
  selectedId,
  onSelect,
}: {
  team: Team;
  label: string;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="team-list">
      <div className="team-heading">
        <strong>{label}</strong>
        <span className="mono">{team.mean_mmr.toLocaleString()} MMR</span>
      </div>
      {team.players.map((p: Player) => (
        <button
          className={`team-player ${selectedId === p.id ? "selected" : ""}`}
          key={p.id}
          onClick={() => onSelect(p.id)}
          aria-label={`Inspect ${p.name}`}
          aria-pressed={selectedId === p.id}
        >
          <Avatar player={p} />
          <span className="team-player-identity">
            <strong>{p.name}</strong>
            <small>
              {p.role} <span className="mono">/ {p.mmr.toLocaleString()}</span>
            </small>
          </span>
          <span className="team-player-data">
            <small>trust {p.trust}</small>
            <span className={`risk-number ${p.risk.level.toLowerCase()}`}>
              {p.risk.score.toFixed(0)} risk
            </span>
          </span>
        </button>
      ))}
      <div className="team-footer">
        <span>
          Avg. trust <strong>{team.mean_trust}</strong>
        </span>
        <span className={team.high_risk_count > 1 ? "coral-text" : "mint-text"}>
          {team.high_risk_count} high-risk{" "}
          {team.high_risk_count === 1 ? "player" : "players"}
        </span>
      </div>
    </div>
  );
}

function Lobby({
  match,
  optimized,
  selectedId,
  onSelect,
}: {
  match: Match;
  optimized?: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={`lobby ${optimized ? "optimized-lobby" : ""}`}>
      <div className="lobby-heading">
        <span>Lobby {match.lobby}</span>
        <span className="mono">{match.skill_gap} MMR gap</span>
      </div>
      <div className="team-grid">
        {match.teams.map((team, i) => (
          <TeamList
            key={i}
            team={team}
            label={`Team ${i ? "B" : "A"}`}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="lobby-result">
        <span className={match.risk_pairs ? "coral-text" : "mint-text"}>
          {match.risk_pairs} high-risk teammate{" "}
          {match.risk_pairs === 1 ? "pair" : "pairs"}
        </span>
        <span>
          {match.cap_met ? (
            <>
              <CheckCircle2 size={13} /> Skill limit met
            </>
          ) : (
            "Skill limit infeasible"
          )}
        </span>
      </div>
    </div>
  );
}

export default function Matchmaking({
  result,
  selectedId,
  onSelect,
  limit,
  onLimit,
  onRecompute,
  busy,
  player,
}: {
  result: MatchResult;
  selectedId: string;
  onSelect: (id: string) => void;
  limit: number;
  onLimit: (v: number) => void;
  onRecompute: () => void;
  busy: boolean;
  player: Player;
}) {
  const before = result.baseline.matches
    .flatMap((m) => m.teams)
    .find((t) => t.players.some((p) => p.id === selectedId))!;
  const after = result.optimized.matches
    .flatMap((m) => m.teams)
    .find((t) => t.players.some((p) => p.id === selectedId))!;
  const same =
    before.players
      .filter((p) => p.id !== selectedId)
      .map((p) => p.id)
      .sort()
      .join() ===
    after.players
      .filter((p) => p.id !== selectedId)
      .map((p) => p.id)
      .sort()
      .join();
  const exportResult = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zen-flow-window-${result.tick}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="matchmaking-view">
      <Panel
        title="Fairness controls"
        icon={SlidersHorizontal}
        className="fairness-panel"
        action={
          <button className="text-button" onClick={exportResult}>
            <Download size={14} /> Export decision
          </button>
        }
      >
        <div className="fairness-controls">
          <div>
            <h3>Skill is a constraint. Behavior is a signal.</h3>
            <p>
              Same 20 players, same ratings, same two skill lobbies. We only
              recommend team composition.
            </p>
          </div>
          <label htmlFor="mmr-limit">
            <span>
              Maximum team MMR gap <strong className="mono">{limit}</strong>
            </span>
            <input
              id="mmr-limit"
              type="range"
              min={0}
              max={150}
              step={10}
              value={limit}
              onChange={(e) => onLimit(Number(e.target.value))}
              disabled={busy}
            />
          </label>
          <button
            className="button primary small"
            disabled={busy}
            onClick={onRecompute}
          >
            <RefreshCw size={15} /> Recompute
          </button>
        </div>
        {limit !== result.max_skill_gap ? (
          <p className="pending-limit" role="status">
            Limit changed. Recompute to apply {limit} MMR.
          </p>
        ) : null}
      </Panel>
      <div className="comparison-metrics">
        <div>
          <span>High-risk teammate pairs</span>
          <p>
            <strong>{result.baseline.risk_pairs}</strong>
            <ArrowRight size={23} />
            <strong className="mint-text" data-testid="optimized-pairs">
              {result.optimized.risk_pairs}
            </strong>
          </p>
          <small>Distribution metric, not a predicted outcome</small>
        </div>
        <div>
          <span>Maximum skill gap</span>
          <p>
            <strong>{result.optimized.max_skill_gap}</strong>
            <small>MMR</small>
            <ShieldCheck size={25} className="mint-text" />
          </p>
          <small>Configured limit: {result.max_skill_gap} MMR</small>
        </div>
        <div>
          <span>Partitions evaluated</span>
          <p>
            <strong>{result.partitions_evaluated}</strong>
            <small>splits</small>
          </p>
          <small>Exhaustive search across both lobbies</small>
        </div>
      </div>
      <div className="match-columns">
        <section aria-label="Skill-only assignment">
          <div className="assignment-heading">
            <span className="comparison-tag">Original composition</span>
            <h2>Skill-only baseline</h2>
            <p>Minimize MMR difference alone.</p>
          </div>
          {result.baseline.matches.map((match) => (
            <Lobby
              key={match.lobby}
              match={match}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </section>
        <section aria-label="Zen-Flow assignment">
          <div className="assignment-heading">
            <span className="comparison-tag mint-text">
              Proposed composition
            </span>
            <h2>Zen-Flow recommendation</h2>
            <p>Skill-balanced, behavior-aware.</p>
          </div>
          {result.optimized.matches.map((match) => (
            <Lobby
              key={match.lobby}
              match={match}
              optimized
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </section>
      </div>
      <Panel
        title={`Why this recommendation for ${player.name}?`}
        icon={Users}
        className="decision-panel"
      >
        <div className="decision-summary">
          <Avatar player={player} />
          <p>
            {same
              ? `${player.name}'s teammate composition is unchanged at the best feasible allocation.`
              : `${player.name} receives a different teammate composition within the same skill lobby.`}{" "}
            Teammate trust averages{" "}
            <strong>
              {(
                (before.players.reduce((n, p) => n + p.trust, 0) -
                  player.trust) /
                4
              ).toFixed(1)}
            </strong>{" "}
            →{" "}
            <strong className="mint-text">
              {(
                (after.players.reduce((n, p) => n + p.trust, 0) -
                  player.trust) /
                4
              ).toFixed(1)}
            </strong>
            . Risk is {player.risk.score.toFixed(0)}/100 (
            {player.risk.level.toLowerCase()}).
          </p>
        </div>
        <ol className="decision-steps">
          <li>
            <ShieldCheck size={18} />
            <div>
              <strong>Preserve skill fairness</strong>
              <p>
                Keep existing skill-lobby membership; enforce the visible mean
                team MMR gap.
              </p>
            </div>
          </li>
          <li>
            <ArrowDown size={18} />
            <div>
              <strong>Separate high-risk signals where possible</strong>
              <p>
                Minimize the number of High-risk players sharing a team; High
                means a model score ≥65.
              </p>
            </div>
          </li>
          <li>
            <Users size={18} />
            <div>
              <strong>Prefer higher-trust teammates</strong>
              <p>
                Among equal risk-pair solutions, maximize average simulated
                teammate trust around high-risk players, then minimize skill
                gap.
              </p>
            </div>
          </li>
        </ol>
        {result.explanations.map((e) => (
          <div className="allocation-explanation" key={e.lobby}>
            <CheckCircle2 size={16} />
            <p>
              {e.text}
              <small>{e.tradeoff}</small>
              {e.constraint_warning ? (
                <strong className="coral-text">{e.constraint_warning}</strong>
              ) : null}
            </p>
          </div>
        ))}
        <p className="policy-note">
          {result.outcome_policy} Players are not responsible for managing
          another player's behavior. These are reviewable recommendations.
        </p>
      </Panel>
    </div>
  );
}
