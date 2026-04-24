import { createPublicClient, http, type Abi, type PublicClient } from 'viem'
import { defineChain } from 'viem'
import { config } from './config'

const REPUTATION_ABI = [
  {
    type: 'function',
    name: 'getReputation',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'int256' }],
  },
] as const satisfies Abi

const arc = defineChain({
  id: config.ARC_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.ARC_RPC_URL] } },
})

let client: PublicClient | null = null
function getClient(): PublicClient {
  if (!client) {
    client = createPublicClient({ chain: arc, transport: http(config.ARC_RPC_URL) })
  }
  return client
}

type CacheEntry = { value: number; fetchedAt: number; inflight?: Promise<number | undefined> }
const TTL_MS = 30_000
const cache = new Map<number, CacheEntry>()

/**
 * Read an agent's on-chain reputation. Cached per-tokenId for 30s to avoid
 * hammering the RPC on every heartbeat (5 nodes × ~7s cadence = ~43 req/min
 * uncached; with TTL ≈ 10 req/min instead).
 *
 * Returns undefined if registry env isn't configured, tokenId is 0, or the
 * RPC call fails — caller should treat as "identity but no score yet".
 */
export async function readReputationOnChain(tokenId: number): Promise<number | undefined> {
  if (!tokenId) return undefined
  const addr = config.ORACLE_REGISTRY_ADDRESS
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return undefined

  const cached = cache.get(tokenId)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < TTL_MS) return cached.value
  if (cached?.inflight) return cached.inflight

  const inflight = (async () => {
    try {
      const raw = await getClient().readContract({
        address: addr as `0x${string}`,
        abi: REPUTATION_ABI,
        functionName: 'getReputation',
        args: [BigInt(tokenId)],
      })
      const value = Number(raw as bigint)
      cache.set(tokenId, { value, fetchedAt: Date.now() })
      return value
    } catch (err: any) {
      // Keep stale value if we had one; otherwise mark absent.
      const prev = cache.get(tokenId)
      if (prev) {
        cache.set(tokenId, { ...prev, inflight: undefined })
        return prev.value
      }
      return undefined
    }
  })()

  cache.set(tokenId, { value: cached?.value ?? 0, fetchedAt: cached?.fetchedAt ?? 0, inflight })
  const out = await inflight
  cache.set(tokenId, { value: out ?? 0, fetchedAt: Date.now() })
  return out
}
