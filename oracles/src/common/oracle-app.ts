import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { z } from 'zod'
import { PRICE_USDC_MICRO } from './config'
import { requirePayment } from './x402-server'
import { startHeartbeat } from './heartbeat'
import { geminiSummarize, geminiVerdict } from './gemini'
import { reportNanopay } from './nanopay-client'
import type { EvidenceItem, OracleMetrics, OraclePersona } from './types'

const MICRO_TO_USDC = 1_000_000

export type EvidenceFetcher = (args: {
  topic: string
  cursor?: string
}) => Promise<EvidenceItem>

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
    requirePayment({ amountMicroUsdc: PRICE_USDC_MICRO.evidence, payTo: persona.walletAddress, description: 'evidence item', personaId: persona.dataSource }),
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

        logLine(persona, `evidence served topic="${topic.slice(0, 40)}" tx=${req.payment?.txHash.slice(0, 10)}…`)
        void reportNanopay(persona, {
          kind: 'evidence',
          amountUsdc: Number(PRICE_USDC_MICRO.evidence) / MICRO_TO_USDC,
          txHash: req.payment?.txHash ?? 'unknown',
        })
        res.json({
          ...item,
          txHash: req.payment?.txHash,
          settledAt: req.payment?.settledAt,
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
    requirePayment({ amountMicroUsdc: PRICE_USDC_MICRO.summarize, payTo: persona.walletAddress, description: 'summary', personaId: persona.dataSource }),
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

        logLine(persona, `summarized ${evidence.length} items (gemini ${result.latencyMs}ms)`)
        void reportNanopay(persona, {
          kind: 'summarize',
          amountUsdc: Number(PRICE_USDC_MICRO.summarize) / MICRO_TO_USDC,
          txHash: req.payment?.txHash ?? 'unknown',
        })
        res.json({
          summary: result.summary,
          relevance: result.relevance,
          evidenceCount: result.evidenceCount,
          txHash: req.payment?.txHash,
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
    requirePayment({ amountMicroUsdc: PRICE_USDC_MICRO.verdict, payTo: persona.walletAddress, description: 'verdict', personaId: persona.dataSource }),
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

        logLine(persona, `verdict=${v.verdict} conf=${v.confidence.toFixed(2)} (gemini ${v.latencyMs}ms)`)
        void reportNanopay(persona, {
          kind: 'verdict',
          amountUsdc: Number(PRICE_USDC_MICRO.verdict) / MICRO_TO_USDC,
          txHash: req.payment?.txHash ?? 'unknown',
          verdict: v.verdict,
          confidence: v.confidence,
        })
        res.json({
          verdict: v.verdict,
          confidence: v.confidence,
          reasoning: v.reasoning,
          cites: v.cites,
          txHash: req.payment?.txHash,
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
    console.log(`    mode:   x402=${process.env.X402_MODE ?? 'mock'}`)
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
