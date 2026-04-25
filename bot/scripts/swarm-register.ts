#!/usr/bin/env tsx
// Register all 5 oracle swarm agents on the OracleRegistry contract (ERC-8004).
//
//   ORACLE_REGISTRY_ADDRESS=0x...  \
//   REPUTATION_CHAIN_ID=5042002    \
//   BOT_PRIVATE_KEY=0x...          \
//   tsx scripts/swarm-register.ts
//
// After this script runs successfully, copy the printed tokenIds into
// oracles/.env as AGENT_TOKEN_{TWITTER,GOOGLE,NEWS,REDDIT,YOUTUBE} so the
// heartbeat payloads start carrying identity + reputation on the dashboard.

import { getPublicClient, getWalletClient } from "../src/common/services/blockchain"
import { decodeEventLog, type Abi } from "viem"

const ORACLE_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "dataSource", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "dataSource", type: "string", indexed: false },
      { name: "endpoint", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const satisfies Abi

const AGENTS = [
  { key: "TWITTER", name: "Twitter Scout",    dataSource: "twitter", endpoint: "http://localhost:4001" },
  { key: "GOOGLE",  name: "Google Indexer",   dataSource: "google",  endpoint: "http://localhost:4002" },
  { key: "NEWS",    name: "GDELT Sentinel",   dataSource: "news",    endpoint: "http://localhost:4003" },
  { key: "REDDIT",  name: "Reddit Watcher",   dataSource: "reddit",  endpoint: "http://localhost:4004" },
  { key: "YOUTUBE", name: "YouTube Probe",    dataSource: "youtube", endpoint: "http://localhost:4005" },
  { key: "MAPS",    name: "Maps Navigator",   dataSource: "maps",    endpoint: "http://localhost:4006" },
  { key: "WEATHER", name: "Weather Sentinel", dataSource: "weather", endpoint: "http://localhost:4007" },
] as const

async function main() {
  const registry = process.env.ORACLE_REGISTRY_ADDRESS as `0x${string}` | undefined
  const chainId = Number(process.env.REPUTATION_CHAIN_ID ?? 0)
  if (!registry || !/^0x[0-9a-fA-F]{40}$/.test(registry)) {
    console.error("ORACLE_REGISTRY_ADDRESS missing or malformed")
    process.exit(1)
  }
  if (!chainId) {
    console.error("REPUTATION_CHAIN_ID missing")
    process.exit(1)
  }

  const publicClient = getPublicClient(chainId)
  const walletClient = getWalletClient(chainId)
  if (!walletClient) {
    console.error("bot wallet unavailable — set BOT_PRIVATE_KEY")
    process.exit(1)
  }

  console.log("")
  console.log(`→ registering 5 oracle agents on OracleRegistry ${registry}`)
  console.log(`  chainId=${chainId} admin=${walletClient.account?.address}`)
  console.log("")

  const results: { key: string; tokenId: bigint; tx: string }[] = []

  for (const a of AGENTS) {
    process.stdout.write(`  ${a.name.padEnd(18)} ${a.dataSource.padEnd(8)} → `)
    try {
      const { request } = await publicClient.simulateContract({
        address: registry,
        abi: ORACLE_REGISTRY_ABI,
        functionName: "register",
        args: [a.name, a.dataSource, a.endpoint, ""],
        account: walletClient.account!,
      })
      const txHash = await walletClient.writeContract(request)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      if (receipt.status !== "success") throw new Error("receipt reverted")

      // Parse tokenId from the AgentRegistered event — concurrency-safe
      // vs. reading nextTokenId() after the fact.
      let tokenId: bigint | null = null
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== registry.toLowerCase()) continue
        try {
          const decoded = decodeEventLog({ abi: ORACLE_REGISTRY_ABI, data: log.data, topics: log.topics })
          if (decoded.eventName === "AgentRegistered") {
            tokenId = (decoded.args as { tokenId: bigint }).tokenId
            break
          }
        } catch {
          // not our event, keep scanning
        }
      }
      if (tokenId === null) throw new Error("AgentRegistered event missing from receipt")

      results.push({ key: a.key, tokenId, tx: txHash })
      console.log(`tokenId=${tokenId}  tx=${txHash}`)
    } catch (err: any) {
      console.log(`FAILED — ${err?.shortMessage ?? err?.message}`)
    }
  }

  if (results.length === 0) {
    console.error("no agents registered")
    process.exit(1)
  }

  console.log("")
  console.log("─ paste into oracles/.env ─────────────────────────────────────────")
  console.log(`ORACLE_REGISTRY_ADDRESS=${registry}`)
  for (const r of results) {
    console.log(`AGENT_TOKEN_${r.key}=${r.tokenId}`)
  }
  console.log("────────────────────────────────────────────────────────────────────")
  console.log("")
  console.log("then: cd oracles && npm run swarm:restart")
  console.log("")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
