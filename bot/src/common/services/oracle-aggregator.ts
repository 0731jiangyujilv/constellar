import { randomUUID } from "node:crypto"
import { x402Fetch } from "./x402-client"

export type OracleEndpoint = {
  id: string
  name: string
  emoji: string
  dataSource: string
  baseUrl: string
}

export const ORACLE_SWARM: OracleEndpoint[] = [
  { id: "oracle-twitter-01", name: "Twitter Scout",    emoji: "🐦",  dataSource: "twitter", baseUrl: process.env.ORACLE_TWITTER_URL ?? "http://localhost:4001" },
  { id: "oracle-google-02",  name: "Google Indexer",   emoji: "🔎",  dataSource: "google",  baseUrl: process.env.ORACLE_GOOGLE_URL  ?? "http://localhost:4002" },
  { id: "oracle-news-03",    name: "GDELT Sentinel",   emoji: "📰",  dataSource: "news",    baseUrl: process.env.ORACLE_NEWS_URL    ?? "http://localhost:4003" },
  { id: "oracle-reddit-04",  name: "Reddit Watcher",   emoji: "👽",  dataSource: "reddit",  baseUrl: process.env.ORACLE_REDDIT_URL  ?? "http://localhost:4004" },
  { id: "oracle-youtube-05", name: "YouTube Probe",    emoji: "📺",  dataSource: "youtube", baseUrl: process.env.ORACLE_YOUTUBE_URL ?? "http://localhost:4005" },
  { id: "oracle-maps-06",    name: "Maps Navigator",   emoji: "🗺️", dataSource: "maps",    baseUrl: process.env.ORACLE_MAPS_URL    ?? "http://localhost:4006" },
  { id: "oracle-weather-07", name: "Weather Sentinel", emoji: "🌤️", dataSource: "weather", baseUrl: process.env.ORACLE_WEATHER_URL ?? "http://localhost:4007" },
]

export type EvidenceItem = {
  id: string
  text: string
  url: string
  author?: string
  timestamp: string
  source: string
  cursor?: string
}

export type PerOracleResult = {
  oracle: OracleEndpoint
  evidence: EvidenceItem[]
  evidenceTxHashes: string[]
  summary: string | null
  summaryTxHash: string | null
  verdict: "YES" | "NO"
  confidence: number
  reasoning: string
  verdictTxHash: string | null
  error?: string
}

export type AggregateResolution = {
  outcome: "YES" | "NO"
  confidence: number
  spread: number
  reasoning: string
  perOracle: PerOracleResult[]
  receipts: string[]
  totalNanopayments: number
  totalSpentUsdc: number
  /** Shared Circle Gateway batch correlation id threaded via X-Batch-Id. */
  batchId: string
}

type AggregatorOpts = {
  evidencePerOracle?: number
  includeOracles?: string[]
  /** Optional batch id; aggregator generates one per run if not supplied. */
  batchId?: string
}

function fmtHash(tx: string | null): string {
  if (!tx) return "-"
  return tx.length > 12 ? `${tx.slice(0, 8)}…${tx.slice(-4)}` : tx
}

async function collectFromOracle(
  oracle: OracleEndpoint,
  question: string,
  topic: string,
  evidencePerOracle: number,
  batchId: string,
): Promise<PerOracleResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Batch-Id": batchId,
  }

  const evidence: EvidenceItem[] = []
  const evidenceTxHashes: string[] = []
  let summary: string | null = null
  let summaryTxHash: string | null = null
  let verdict: "YES" | "NO" = "NO"
  let confidence = 0.3
  let reasoning = "no data collected"
  let verdictTxHash: string | null = null

  try {
    // Tier 1 — pull N evidence items, each a separate nanopayment
    let cursor: string | undefined
    for (let i = 0; i < evidencePerOracle; i++) {
      const url = new URL("/evidence", oracle.baseUrl)
      url.searchParams.set("topic", topic)
      if (cursor) url.searchParams.set("cursor", cursor)
      const r = await x402Fetch<EvidenceItem>(url.toString(), { method: "GET", headers })
      evidence.push(r.data)
      evidenceTxHashes.push(r.transferId)
      cursor = r.data.cursor
    }

    // Tier 2 — summarize the batch (1 nanopayment)
    const sumRes = await x402Fetch<{ summary: string; relevance: number }>(
      new URL("/summarize", oracle.baseUrl).toString(),
      {
        method: "POST",
        headers,
        body: { question, evidence },
      },
    )
    summary = sumRes.data.summary
    summaryTxHash = sumRes.transferId

    // Tier 3 — final verdict (1 nanopayment)
    const vRes = await x402Fetch<{ verdict: "YES" | "NO"; confidence: number; reasoning: string }>(
      new URL("/verdict", oracle.baseUrl).toString(),
      {
        method: "POST",
        headers,
        body: { question, summary, cites: evidence.map((e) => e.url) },
      },
    )
    verdict = vRes.data.verdict
    confidence = vRes.data.confidence
    reasoning = vRes.data.reasoning
    verdictTxHash = vRes.transferId

    return { oracle, evidence, evidenceTxHashes, summary, summaryTxHash, verdict, confidence, reasoning, verdictTxHash }
  } catch (err: any) {
    return {
      oracle,
      evidence,
      evidenceTxHashes,
      summary,
      summaryTxHash,
      verdict: "NO",
      confidence: 0.1,
      reasoning: `oracle error: ${err?.message ?? "unknown"}`,
      verdictTxHash,
      error: err?.message ?? "unknown",
    }
  }
}

/**
 * Query all 5 oracles in parallel and aggregate their verdicts via
 * confidence-weighted majority vote.
 *
 * One event resolution produces:
 *    5 oracles × (N evidence + 1 summarize + 1 verdict)
 * nanopayments. With default N=5 → 35 nanopayments / event.
 */
export async function resolveWithSwarm(
  question: string,
  topic: string,
  opts: AggregatorOpts = {},
): Promise<AggregateResolution> {
  const evidencePerOracle = opts.evidencePerOracle ?? 5
  const nodes = opts.includeOracles
    ? ORACLE_SWARM.filter((o) => opts.includeOracles!.includes(o.id))
    : ORACLE_SWARM

  // One batchId covers every nanopay in this swarm resolve round. Passed via
  // X-Batch-Id header to every oracle so the UI can group ~35 rows under a
  // single "BATCH" card and prove Circle Gateway's batched settlement visually.
  const batchId = opts.batchId ?? randomUUID()

  const started = Date.now()
  const perOracle = await Promise.all(
    nodes.map((o) => collectFromOracle(o, question, topic, evidencePerOracle, batchId)),
  )

  // Confidence-weighted vote
  let yesW = 0
  let noW = 0
  for (const r of perOracle) {
    if (r.verdict === "YES") yesW += r.confidence
    else noW += r.confidence
  }
  const outcome = yesW >= noW ? (yesW > noW ? "YES" : "NO") : "NO"
  const totalW = yesW + noW || 1
  const spread = Math.max(yesW, noW) / totalW

  const receipts: string[] = []
  let totalSpentMicro = 0n
  for (const r of perOracle) {
    for (const tx of r.evidenceTxHashes) {
      receipts.push(tx)
      totalSpentMicro += 1000n
    }
    if (r.summaryTxHash) {
      receipts.push(r.summaryTxHash)
      totalSpentMicro += 3000n
    }
    if (r.verdictTxHash) {
      receipts.push(r.verdictTxHash)
      totalSpentMicro += 5000n
    }
  }

  const reasoning = [
    `Swarm resolved: ${outcome} (yesW=${yesW.toFixed(2)} / noW=${noW.toFixed(2)})`,
    ...perOracle.map(
      (r) =>
        `[${r.oracle.emoji} ${r.oracle.dataSource}@${r.confidence.toFixed(2)}→${r.verdict}] ${r.reasoning.slice(0, 160)}`,
    ),
    `Evidence URLs: ${perOracle.flatMap((r) => r.evidence.map((e) => e.url)).join(",")}`,
    `Elapsed: ${Date.now() - started}ms, nanopayments: ${receipts.length}`,
  ].join(" | ")

  console.log(
    `🧠 swarm resolved "${question.slice(0, 60)}" → ${outcome} (spread ${spread.toFixed(2)}) | ` +
      `${receipts.length} nanopays, $${(Number(totalSpentMicro) / 1_000_000).toFixed(4)} | ` +
      `${perOracle.map((r) => `${r.oracle.emoji}${r.verdict.toLowerCase()}(${fmtHash(r.verdictTxHash)})`).join(" ")}`,
  )

  return {
    outcome,
    confidence: spread,
    spread,
    reasoning,
    perOracle,
    receipts,
    totalNanopayments: receipts.length,
    totalSpentUsdc: Number(totalSpentMicro) / 1_000_000,
    batchId,
  }
}
