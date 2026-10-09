export type RiskLevel = 'Low' | 'Medium' | 'High'
export type Scenario = 'balanced' | 'pressure' | 'recovery'
export type View = 'overview' | 'matchmaking' | 'models'
export interface Signal {
  feature: string; label: string; value: number; contribution: number
  direction: 'raises' | 'lowers'; explanation: string
}
export interface Risk {
  score: number; level: RiskLevel; signals: Signal[]; reference_score: number; explanation_method: string
}
export interface ChatAnalysis {
  label: 'neutral' | 'frustrated' | 'toxic'; risk: number
  probabilities: Record<'neutral' | 'frustrated' | 'toxic', number>
}
export interface Player {
  id: string; name: string; role: string; color: string; mmr: number; trust: number
  baseline_cpm: number; baseline_kd: number; win_rate: number; matches: number
  features: Record<string, number>; risk: Risk; history: { tick: number; score: number }[]
  recent_chat: (ChatAnalysis & { text: string })[]
}
export interface TelemetryEvent {
  id: string; tick: number; time: string; player_id: string; player: string
  category: 'Mouse' | 'Performance' | 'Chat'; text: string; severity: string; chat: ChatAnalysis | null
}
export interface Snapshot {
  seed: number; tick: number; synthetic: boolean; players: Player[]; events: TelemetryEvent[]
  history: { tick: number; time: string; average: number; selected: number }[]
  stats: { players: number; high_risk: number; average_trust: number; average_risk: number }
}
export interface Team {
  players: Player[]; mean_mmr: number; mean_trust: number; high_risk_count: number; risk_pairs: number
}
export interface Match {
  teams: Team[]; skill_gap: number; risk_pairs: number; lobby: number; cap_met: boolean
}
export interface Assignment {
  matches: Match[]; risk_pairs: number; max_skill_gap: number; average_skill_gap: number
}
export interface MatchResult {
  baseline: Assignment; optimized: Assignment; max_skill_gap: number; partitions_evaluated: number
  explanations: { lobby: number; text: string; constraint_warning: string | null; tradeoff: string }[]
  policy: string; outcome_policy: string; synthetic: boolean; tick: number
}
export interface ModelInfo {
  version: string; seed: number; dataset_fingerprint: string; algorithm: string; nlp_algorithm: string
  train_windows: number; test_windows: number; train_players: number; test_players: number
  roc_auc: number; f1: number; brier_score: number; confusion_matrix: number[][]; split: string
  features: { name: string; label: string; importance: number }[]; limitations: string[]
  nlp: { train_messages: number; test_messages: number; train_templates: number; test_templates: number
    accuracy: number; macro_f1: number; classes: string[]; confusion_matrix: number[][] }
}
