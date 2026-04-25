#!/usr/bin/env tsx
// Standalone CLI: resolve a question via the oracle swarm without needing a
// deployed EventBet contract. Useful for demo recording + smoke-testing the
// full Circle Gateway nanopayment flow end to end.
//
//   tsx scripts/swarm-resolve.ts "Will BTC close above 70k on 2026-04-24?" "BTC price"
//
// Current topology: 7 oracles × (5 evidence + 1 summarize + 1 verdict) = 49
// nanopayments per resolve. Each one is a Circle Gateway x402 call; they all
// share one X-Batch-Id so Gateway can settle them as a single onchain batch.
//
// Prereq: the bot wallet's BOT_PRIVATE_KEY must already have deposited USDC
// into Circle Gateway. If not, run `npm run gateway:deposit -- 5` first.

import { resolveWithSwarm } from "../src/common/services/oracle-aggregator"

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length)
}

function shortId(s: string | null | undefined): string {
  if (!s) return "-"
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s
}

async function main() {
  const question = process.argv[2] ?? "Will the U.S.-Iran ceasefire be formally extended again before April 25th, 2026?"
  const topic = process.argv[3] ?? "Middle East conflict"
  // Allow smoke-test runs with a smaller tier-1 count via env:
  //   EVIDENCE_PER_ORACLE=1 npx tsx scripts/swarm-resolve.ts
  const evidencePerOracle = Number(process.env.EVIDENCE_PER_ORACLE ?? 5)

  console.log("═".repeat(78))
  console.log(`  QUESTION : ${question}`)
  console.log(`  TOPIC    : ${topic}`)
  console.log(`  PAYMENTS : Circle Gateway batched x402 (gasless for buyer)`)
  console.log(`  EVIDENCE : ${evidencePerOracle} per oracle (${evidencePerOracle * 7 + 7 * 2} nanopays total)`)
  console.log("═".repeat(78))

  const t0 = Date.now()
  const result = await resolveWithSwarm(question, topic, { evidencePerOracle })
  const elapsed = Date.now() - t0

  // console.log("")
  // console.log("─ PER-ORACLE ─────────────────────────────────────────────────────────────────")
  // for (const r of result.perOracle) {
  //   const tag = `${r.oracle.emoji} ${pad(r.oracle.dataSource, 8)}`
  //   const v = r.verdict === "YES" ? "\x1b[32mYES\x1b[0m" : "\x1b[31mNO \x1b[0m"
  //   const nano = r.evidenceTxHashes.length + (r.summaryTxHash ? 1 : 0) + (r.verdictTxHash ? 1 : 0)
  //   console.log(
  //     `  ${tag}  ${v}  conf=${r.confidence.toFixed(2)}  nanopays=${nano}  ` +
  //       `verdictXfer=${shortId(r.verdictTxHash)}  reason="${r.reasoning.slice(0, 56)}"`,
  //   )
  // }

  console.log("")
  console.log("─ AGGREGATE ──────────────────────────────────────────────────────────────────")
  console.log(`  FINAL OUTCOME     : ${result.outcome}`)
  console.log(`  CONSENSUS SPREAD  : ${result.spread.toFixed(2)}`)
  console.log(`  TOTAL NANOPAYS    : ${result.totalNanopayments}`)
  console.log(`  TOTAL SPENT USDC  : $${result.totalSpentUsdc.toFixed(4)}`)
  console.log(`  BATCH ID          : ${result.batchId}`)
  console.log(`  ELAPSED           : ${elapsed}ms`)
  console.log("")
  console.log("─ CIRCLE TRANSFER IDS ───────────────────────────────────────────────────────")
  console.log("  (these are Gateway transfer ids — the actual onchain settlement tx")
  console.log("   lands later when Gateway flushes the batch; the service poller")
  console.log("   backfills the settlementTxHash into the swarm UI.)")
  console.log("")
  result.receipts.forEach((id, i) => {
    process.stdout.write(`  [${String(i + 1).padStart(2)}] ${shortId(id)}${(i + 1) % 4 === 0 ? "\n" : "  "}`)
  })
  if (result.receipts.length % 4 !== 0) console.log("")
  console.log("")
}

main().catch((err) => {
  console.error("swarm-resolve error:", err)
  process.exit(1)
})
