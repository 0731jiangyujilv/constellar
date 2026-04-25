import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { z } from 'zod'
import { PRICE_USDC_MICRO } from './config'
import { requirePayment } from './x402-server'
import { startHeartbeat } from './heartbeat'
import { geminiSummarize, geminiVerdict } from './gemini'
import { reportNanopay } from './nanopay-client'
import type { EvidenceItem, NanoPaymentKind, OracleMetrics, OraclePersona } from './types'

const MICRO_TO_USDC = 1_000_000

// Circle Gateway middleware takes dollar strings. Kept in sync with
// PRICE_USDC_MICRO so internal metrics and wire prices don't drift.
const PRICE_STRING = {
  evidence: '$0.001',
  summarize: '$0.003',
  verdict: '$0.005',
} as const

function nanopayFrom(
  persona: OraclePersona,
  kind: NanoPaymentKind,
  req: Request,
  extra: { verdict?: 'YES' | 'NO'; confidence?: number } = {},
) {
  const p = req.payment
  if (!p) return null
  return {
    kind,
    amountUsdc: p.amountUsdc,
    transferId: p.transferId,
    batchId: p.batchId,
    payer: p.payer,
    ...extra,
  }
}

export type EvidenceFetcher = (args: {
  topic: string
  cursor?: string
}) => Promise<EvidenceItem | null>

const summarizeBodySchema = z.object({
  question: z.string().min(1).max(500),
  evidence: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        url: z.string(),
        timestamp: z.string(),
        source: z.string(),
      }),
    )
    .min(1)
    .max(50),
})

const verdictBodySchema = z.object({
  question: z.string().min(1).max(500),
  summary: z.string().min(1).max(4000),
  cites: z.array(z.string()).max(50).default([]),
})

function logLine(persona: OraclePersona, line: string) {
  const stamp = new Date().toISOString().slice(11, 23)
  console.log(`${stamp} ${persona.emoji}  [${persona.name}] ${line}`)
}

export function createOracleApp(persona: OraclePersona, fetcher: EvidenceFetcher) {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '256kb' }))

  const metrics: OracleMetrics = {
    startedAt: Date.now(),
    queries1h: 0,
    queries24h: 0,
    evidenceServed24h: 0,
    earnings1hMicro: 0n,
    earnings24hMicro: 0n,
    walletBalanceMicro: 0n,
    lastGeminiLatencyMs: 0,
    lastUpstreamLatencyMs: 0,
  }

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      persona: { id: persona.id, name: persona.name, dataSource: persona.dataSource },
      uptimeSec: Math.floor((Date.now() - metrics.startedAt) / 1000),
    })
  })

  // ─── tier 1 · raw evidence ────────────────────────────────────────────
  app.get(
    '/evidence',
    ...requirePayment(persona, PRICE_STRING.evidence),
    async (req: Request, res: Response) => {
      const topic = String(req.query.topic ?? '').trim()
      if (!topic) {
        res.status(400).json({ error: 'topic required' })
        return
      }
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined
      try {
        const t0 = Date.now()
        const item = await fetcher({ topic, cursor })
        metrics.lastUpstreamLatencyMs = Date.now() - t0
        metrics.queries1h += 1
        metrics.queries24h += 1
        metrics.evidenceServed24h += 1
        metrics.earnings1hMicro += PRICE_USDC_MICRO.evidence
        metrics.earnings24hMicro += PRICE_USDC_MICRO.evidence
        metrics.walletBalanceMicro += PRICE_USDC_MICRO.evidence

        const np = nanopayFrom(persona, 'evidence', req)
        logLine(persona, `evidence served topic="${topic.slice(0, 40)}" batch=${np?.batchId?.slice(0, 8) ?? '-'}`)
        if (np) void reportNanopay(persona, np)

        // Fetcher returned null → upstream had nothing real to share. Surface a
        // clearly-marked empty item rather than synthesising fake data, so the
        // downstream summarize/verdict layers can correctly conclude "no
        // evidence" instead of being misled by stub text.
        const payload = item ?? {
          id: `${persona.dataSource}-empty-${Date.now()}`,
          text: `[no live evidence available from ${persona.dataSource} for "${topic.slice(0, 60)}"]`,
          url: '',
          author: persona.name,
          timestamp: new Date().toISOString(),
          source: persona.dataSource,
          cursor: cursor ? String(Number(cursor) + 1) : '1',
          empty: true,
        }
        res.json({
          ...payload,
          transferId: req.payment?.transferId,
          batchId: req.payment?.batchId,
          priceMicroUsdc: PRICE_USDC_MICRO.evidence.toString(),
        })
      } catch (err: any) {
        logLine(persona, `evidence error: ${err?.message}`)
        res.status(500).json({ error: err?.message ?? 'fetcher failed' })
      }
    },
  )

  // ─── tier 2 · summarize ──────────────────────────────────────────────
  app.post(
    '/summarize',
    ...requirePayment(persona, PRICE_STRING.summarize),
    async (req: Request, res: Response) => {
      const parsed = summarizeBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid body', issues: parsed.error.issues })
        return
      }
      const { question, evidence } = parsed.data
      try {
        const result = await geminiSummarize(question, evidence as EvidenceItem[])
        metrics.lastGeminiLatencyMs = result.latencyMs
        metrics.queries1h += 1
        metrics.queries24h += 1
        metrics.earnings1hMicro += PRICE_USDC_MICRO.summarize
        metrics.earnings24hMicro += PRICE_USDC_MICRO.summarize
        metrics.walletBalanceMicro += PRICE_USDC_MICRO.summarize

        const np = nanopayFrom(persona, 'summarize', req)
        logLine(persona, `summarized ${evidence.length} items (gemini ${result.latencyMs}ms) batch=${np?.batchId?.slice(0, 8) ?? '-'}`)
        if (np) void reportNanopay(persona, np)
        res.json({
          summary: result.summary,
          relevance: result.relevance,
          evidenceCount: result.evidenceCount,
          transferId: req.payment?.transferId,
          batchId: req.payment?.batchId,
          priceMicroUsdc: PRICE_USDC_MICRO.summarize.toString(),
        })
      } catch (err: any) {
        logLine(persona, `summarize error: ${err?.message}`)
        res.status(500).json({ error: err?.message ?? 'summarize failed' })
      }
    },
  )

  // ─── tier 3 · verdict ────────────────────────────────────────────────
  app.post(
    '/verdict',
    ...requirePayment(persona, PRICE_STRING.verdict),
    async (req: Request, res: Response) => {
      const parsed = verdictBodySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'invalid body', issues: parsed.error.issues })
        return
      }
      const { question, summary, cites } = parsed.data
      try {
        const v = await geminiVerdict(question, summary, cites)
        metrics.lastGeminiLatencyMs = v.latencyMs
        metrics.queries1h += 1
        metrics.queries24h += 1
        metrics.earnings1hMicro += PRICE_USDC_MICRO.verdict
        metrics.earnings24hMicro += PRICE_USDC_MICRO.verdict
        metrics.walletBalanceMicro += PRICE_USDC_MICRO.verdict

        const np = nanopayFrom(persona, 'verdict', req, { verdict: v.verdict, confidence: v.confidence })
        logLine(persona, `verdict=${v.verdict} conf=${v.confidence.toFixed(2)} (gemini ${v.latencyMs}ms) batch=${np?.batchId?.slice(0, 8) ?? '-'}`)
        if (np) void reportNanopay(persona, np)
        res.json({
          verdict: v.verdict,
          confidence: v.confidence,
          reasoning: v.reasoning,
          cites: v.cites,
          transferId: req.payment?.transferId,
          batchId: req.payment?.batchId,
          priceMicroUsdc: PRICE_USDC_MICRO.verdict.toString(),
        })
      } catch (err: any) {
        logLine(persona, `verdict error: ${err?.message}`)
        res.status(500).json({ error: err?.message ?? 'verdict failed' })
      }
    },
  )

  const server = app.listen(persona.port, () => {
    console.log('')
    console.log(`${persona.emoji}  ${persona.name}`)
    console.log(`    id:     ${persona.id}`)
    console.log(`    source: ${persona.dataSource}`)
    console.log(`    url:    http://localhost:${persona.port}`)
    console.log(`    wallet: ${persona.walletAddress}`)
    console.log(`    mode:   x402=circle-gateway (batched)`)
    console.log('')
  })

  const heartbeatTimer = startHeartbeat(persona, metrics)

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received — ${persona.name} stopping…`)
    clearInterval(heartbeatTimer)
    server.close(() => process.exit(0))
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))

  return { app, server, metrics }
}
