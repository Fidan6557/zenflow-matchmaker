import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from './api'
import type { ChatAnalysis, MatchResult, ModelInfo, Scenario, Snapshot } from './types'

export function useDemo() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [models, setModels] = useState<ModelInfo | null>(null)
  const [matches, setMatches] = useState<MatchResult | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [selectedId, setSelectedId] = useState('p00')
  const [running, setRunning] = useState(false)
  const [scenario, setScenario] = useState<Scenario>('balanced')
  const [limit, setLimit] = useState(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const inFlight = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError('')
    async function initialize() {
      try {
        const [snapshot, model] = await Promise.all([
          request<Snapshot & { session_id: string }>('/sessions', { seed: 2026 }, controller.signal),
          request<ModelInfo>('/model', undefined, controller.signal),
        ])
        const result = await request<MatchResult>(`/sessions/${snapshot.session_id}/matchmaking`, { max_skill_gap: 50 }, controller.signal)
        if (active) {
          setData(snapshot); setModels(model); setMatches(result); setSessionId(snapshot.session_id)
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not connect to the backend.')
      }
    }
    void initialize()
    return () => { active = false; controller.abort() }
  }, [retry])

  const action = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined
    inFlight.current = true; setBusy(true); setError('')
    try { return await operation() }
    catch (e) { setError(e instanceof Error ? e.message : 'Request failed.'); setRunning(false) }
    finally { inFlight.current = false; setBusy(false) }
  }, [])

  const refreshMatches = useCallback(async () => {
    const result = await request<MatchResult>(`/sessions/${sessionId}/matchmaking`, { max_skill_gap: limit })
    setMatches(result)
  }, [sessionId, limit])

  const step = useCallback(() => action(async () => {
    const snapshot = await request<Snapshot>(`/sessions/${sessionId}/step`, { scenario, player_id: selectedId })
    setData(snapshot)
    await refreshMatches()
  }), [action, refreshMatches, scenario, selectedId, sessionId])

  useEffect(() => {
    if (!running || !sessionId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const advance = async () => {
      await step()
      if (!cancelled) timer = setTimeout(() => void advance(), 1600)
    }
    timer = setTimeout(() => void advance(), 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [running, sessionId, step])

  const reset = () => {
    setRunning(false)
    return action(async () => {
      setData(await request<Snapshot>(`/sessions/${sessionId}/reset`, {}))
      await refreshMatches()
    })
  }

  const sendChat = (text: string) => action(async () => {
    const result = await request<{ analysis: ChatAnalysis; snapshot: Snapshot }>(`/sessions/${sessionId}/chat`, { player_id: selectedId, text })
    setData(result.snapshot)
    await refreshMatches()
    return result.analysis
  })

  return { data, models, matches, selectedId, setSelectedId, running, setRunning, scenario, setScenario,
    limit, setLimit, busy, error, step, reset, sendChat,
    recompute: () => action(refreshMatches), retry: () => setRetry(v => v + 1) }
}
