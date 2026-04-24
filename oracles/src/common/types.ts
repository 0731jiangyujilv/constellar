export type DataSource = 'twitter' | 'google' | 'news' | 'reddit' | 'youtube'

export type EvidenceItem = {
  id: string
  text: string
  url: string
  author?: string
  timestamp: string
  source: DataSource
  cursor?: string
}

export type Summary = {
  summary: string
  relevance: number
  evidenceCount: number
}

export type Verdict = {
  verdict: 'YES' | 'NO'
  confidence: number
  reasoning: string
  cites: string[]
}

export type NanoPaymentKind = 'evidence' | 'summarize' | 'verdict'

export type OraclePersona = {
  id: string
  name: string
  emoji: string
  dataSource: DataSource
  tagline: string
  walletAddress: `0x${string}`
  port: number
  heartbeatIntervalMs: number
  agentTokenId: number
}

export type HeartbeatPayload = {
  nodeId: string
  displayName: string
  emoji: string
  dataSource: DataSource
  status: 'healthy' | 'degraded' | 'offline'
  selfLatencyMs: number
  upstreamLatencyMs: number
  geminiLatencyMs: number
  walletAddress: string
  walletBalanceUsdc: number
  earnings1h: number
  earnings24h: number
  queries1h: number
  queries24h: number
  evidenceServed24h: number
  accuracyVsMajority: number
  uptimeSec: number
  version: string
  timestamp: string

  // ERC-8004-inspired agent identity & reputation (optional, 0 = unregistered)
  agentTokenId?: number
  reputation?: number
  registryAddress?: string
}

export type OracleMetrics = {
  startedAt: number
  queries1h: number
  queries24h: number
  evidenceServed24h: number
  earnings1hMicro: bigint
  earnings24hMicro: bigint
  walletBalanceMicro: bigint
  lastGeminiLatencyMs: number
  lastUpstreamLatencyMs: number
}
