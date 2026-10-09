import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { Player, RiskLevel } from '../types'

export function Panel({ title, icon: Icon, action, children, className = '', id }: {
  title: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; id?: string
}) {
  return <section id={id} className={`panel ${className}`}>
    <div className="panel-heading"><h2>{Icon ? <Icon size={18} aria-hidden="true" /> : null}{title}</h2>{action}</div>
    {children}
  </section>
}

export function Avatar({ player, large = false }: { player: Player; large?: boolean }) {
  return <span className={`avatar ${player.color} ${large ? 'avatar-large' : ''}`} aria-hidden="true">
    {player.id === 'p00' ? <img src="/nova-avatar.png" alt="" /> : <span>{player.name.slice(0, 2)}</span>}
  </span>
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`risk-badge ${level.toLowerCase()}`}><i />{level} risk</span>
}

export function RiskRing({ score, level }: { score: number; level: RiskLevel }) {
  const radius = 47, length = 2 * Math.PI * radius
  return <div className={`risk-ring ${level.toLowerCase()}`} role="img" aria-label={`Tilt risk ${score} out of 100, ${level}`}>
    <svg viewBox="0 0 112 112" aria-hidden="true"><circle className="ring-track" cx="56" cy="56" r={radius} />
      <circle className="ring-fill" cx="56" cy="56" r={radius} strokeDasharray={length} strokeDashoffset={length * (1 - score / 100)} /></svg>
    <div><strong data-testid="risk-score">{Math.round(score)}</strong><span>/ 100</span></div>
  </div>
}

export function Logo() {
  return <svg className="brand-mark" width="58" height="48" viewBox="0 0 58 48" fill="none" aria-hidden="true">
    <path d="M7 7h29L8 35h27" stroke="var(--mint)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M34 20h20m-20 0-7 23m4-12h15" stroke="var(--lavender)" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
}
