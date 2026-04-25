import { randomBytes } from 'node:crypto'
import { config } from './config'
import type { NanoPaymentKind, OraclePersona } from './types'

const BOT_NANOPAY_URL = config.BOT_HEARTBEAT_URL.replace('/heartbeat', '/nanopay')

export type NanopayReport = {
  kind: NanoPaymentKind
  amountUsdc: number
  /** Circle Gateway transfer id, returned by the seller middleware. */
  transferId: string | null
  /** Correlation id threaded via `X-Batch-Id` header by the buyer. */
  batchId: string | null
  /** Buyer's EOA address from Gateway's verified payment. */
  payer: string
  verdict?: 'YES' | 'NO'
  confidence?: number
}

export async function reportNanopay(persona: OraclePersona, params: NanopayReport) {
  const payload = {
    id: `np-${Date.now()}-${randomBytes(3).toString('hex')}`,
    oracleId: persona.id,
    oracleEmoji: persona.emoji,
    oracleName: persona.name,
    kind: params.kind,
    amountUsdc: params.amountUsdc,
    // For legacy UI compatibility: txHash = transferId until the Gateway poller
    // backfills the real settlement tx hash.
    txHash: params.transferId ?? 'pending',
    transferId: params.transferId,
    batchId: params.batchId,
    payer: params.payer,
    status: 'received',
    verdict: params.verdict,
    confidence: params.confidence,
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
