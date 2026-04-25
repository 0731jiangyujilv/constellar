/**
 * Look up a Circle Gateway transfer by its transferId (UUID returned from
 * client.pay() — surfaced as `receipts[i]` in swarm-resolve output or as
 * SwarmNanopay.transferId in the DB).
 *
 * Prints everything Circle knows about the transfer: status, timestamps, and
 * whatever on-chain settlement tx hash is exposed (Circle has been renaming
 * this field, so we try all the known candidates).
 *
 * Usage:
 *   npx tsx scripts/gateway-lookup.ts <transferId> [transferId...]
 *
 * Example:
 *   npx tsx scripts/gateway-lookup.ts 3f9a8b2e-1c4d-4e7f-9012-abcdef012345
 */
import "dotenv/config"
import { GatewayClient } from "@circle-fin/x402-batching/client"

const SETTLEMENT_HASH_CANDIDATES = [
  "settlementTxHash",
  "settlementTransaction",
  "onChainTxHash",
  "txHash",
  "transactionHash",
] as const

function extractSettlementHash(t: Record<string, unknown>): string | null {
  for (const k of SETTLEMENT_HASH_CANDIDATES) {
    const v = t[k]
    if (typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v)) return v
  }
  return null
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case "completed":
      return `\x1b[32m${status}\x1b[0m`
    case "failed":
      return `\x1b[31m${status}\x1b[0m`
    case "confirmed":
      return `\x1b[36m${status}\x1b[0m`
    case "batched":
      return `\x1b[33m${status}\x1b[0m`
    case "received":
      return `\x1b[90m${status}\x1b[0m`
    default:
      return status ?? "unknown"
  }
}

async function main() {
  const ids = process.argv.slice(2).filter(Boolean)
  if (ids.length === 0) {
    console.error("usage: npx tsx scripts/gateway-lookup.ts <transferId> [transferId...]")
    process.exit(1)
  }

  const pk = process.env.BOT_PRIVATE_KEY
  if (!pk) {
    console.error("BOT_PRIVATE_KEY is required (same key used by the buyer that paid).")
    process.exit(1)
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  })

  const hashes = new Set<string>()
  for (const id of ids) {
    console.log("─".repeat(78))
    console.log(`transferId: ${id}`)
    try {
      const t = (await client.getTransferById(id)) as Record<string, unknown>
      const onchain = extractSettlementHash(t)
      if (onchain) hashes.add(onchain)

      console.log(`  status:            ${statusColor(t.status as string)}`)
      console.log(`  token:             ${t.token ?? "-"}`)
      console.log(`  amount:            ${t.amount ?? "-"}`)
      console.log(`  from:              ${t.fromAddress ?? "-"}`)
      console.log(`  to:                ${t.toAddress ?? "-"}`)
      console.log(`  sendingNetwork:    ${t.sendingNetwork ?? "-"}`)
      console.log(`  recipientNetwork:  ${t.recipientNetwork ?? "-"}`)
      console.log(`  createdAt:         ${t.createdAt ?? "-"}`)
      console.log(`  updatedAt:         ${t.updatedAt ?? "-"}`)
      console.log(`  settlementTxHash:  ${onchain ?? "(not yet settled)"}`)

      // Dump the full raw payload so you can see any field the SDK types don't
      // expose yet — Circle has been adding fields as the API evolves.
      console.log("  raw:")
      console.log(
        JSON.stringify(t, null, 2)
          .split("\n")
          .map((l) => `    ${l}`)
          .join("\n"),
      )
    } catch (err: any) {
      console.error(`  error: ${err?.message ?? err}`)
    }
  }

  if (hashes.size > 0) {
    console.log("─".repeat(78))
    console.log("settlement tx hash(es):")
    for (const h of hashes) {
      console.log(`  ${h}`)
      console.log(`    explorer: https://explorer.arc-testnet.circle.com/tx/${h}`)
    }
  }
}

main().catch((err) => {
  console.error("lookup failed:", err?.shortMessage ?? err?.message ?? err)
  process.exit(1)
})
