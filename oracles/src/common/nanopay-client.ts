import { randomBytes } from 'node:crypto'
import { config } from './config'
import type { NanoPaymentKind, OraclePersona } from './types'

const BOT_NANOPAY_URL = config.BOT_HEARTBEAT_URL.replace('/heartbeat', '/nanopay')

export async function reportNanopay(
  persona: OraclePersona,
  params: {
    kind: NanoPaymentKind
    amountUsdc: number
    txHash: string
    verdict?: 'YES' | 'NO'
    confidence?: number
  },
) {
  const payload = {
    id: `np-${Date.now()}-${randomBytes(3).toString('hex')}`,
    oracleId: persona.id,
    oracleEmoji: persona.emoji,
    oracleName: persona.name,
    ...params,
  }
  try {
    await fetch(BOT_NANOPAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    })
  } catch {
    // best-effort
  }
}
