import { config, VERSION } from './config'
import { readReputationOnChain } from './registry-reader'
import type { HeartbeatPayload, OracleMetrics, OraclePersona } from './types'

const ONE_USDC_MICRO = 1_000_000n

function microToUsdc(micro: bigint): number {
  return Number(micro) / Number(ONE_USDC_MICRO)
}

export function startHeartbeat(persona: OraclePersona, metrics: OracleMetrics) {
  const send = async () => {
    const uptimeSec = Math.floor((Date.now() - metrics.startedAt) / 1000)
    const selfLatency = await probeSelf(persona.port)
    const status: HeartbeatPayload['status'] =
      selfLatency > 700 ? 'degraded' : selfLatency > 0 ? 'healthy' : 'degraded'

    const reputation = await readReputationOnChain(persona.agentTokenId)

    const payload: HeartbeatPayload = {
      nodeId: persona.id,
      displayName: persona.name,
      emoji: persona.emoji,
      dataSource: persona.dataSource,
      status,
      selfLatencyMs: selfLatency,
      upstreamLatencyMs: metrics.lastUpstreamLatencyMs,
      geminiLatencyMs: metrics.lastGeminiLatencyMs,
      walletAddress: persona.walletAddress,
      walletBalanceUsdc: microToUsdc(metrics.walletBalanceMicro),
      earnings1h: microToUsdc(metrics.earnings1hMicro),
      earnings24h: microToUsdc(metrics.earnings24hMicro),
      queries1h: metrics.queries1h,
      queries24h: metrics.queries24h,
      evidenceServed24h: metrics.evidenceServed24h,
      accuracyVsMajority: 0.85,
      uptimeSec,
      version: VERSION,
      timestamp: new Date().toISOString(),
      agentTokenId: persona.agentTokenId || undefined,
      reputation,
      registryAddress: config.ORACLE_REGISTRY_ADDRESS || undefined,
    }

    try {
      await fetch(config.BOT_HEARTBEAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      })
    } catch {
      // swallow — bot may not be running, heartbeats are best-effort
    }
  }

  send()
  return setInterval(send, persona.heartbeatIntervalMs)
}

async function probeSelf(port: number): Promise<number> {
  const t0 = Date.now()
  try {
    await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) })
    return Date.now() - t0
  } catch {
    return 0
  }
}
