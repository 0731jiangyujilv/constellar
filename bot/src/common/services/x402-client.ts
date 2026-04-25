import { GatewayClient } from "@circle-fin/x402-batching/client"
import { config } from "../config"

// Install a fetch shim once — Circle's SDK discards `message` from error bodies,
// so we peek at any non-2xx response and log the raw body. We clone the Response
// so the SDK still sees an un-consumed body.
let fetchShimInstalled = false
function installFetchShim() {
  if (fetchShimInstalled) return
  fetchShimInstalled = true
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const resp = await originalFetch(input, init)
    if (!resp.ok) {
      try {
        const clone = resp.clone()
        const text = await clone.text()
        const method = init?.method ?? "GET"
        const urlStr =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : String(input)
        console.warn(
          `[fetch-shim] ${method} ${urlStr} → ${resp.status}\n  body: ${text.slice(0, 600)}`,
        )
      } catch {
        // ignore shim failures
      }
    }
    return resp
  }) as typeof fetch
}

/**
 * Bot's buyer-side Circle Gateway client. Singleton — the SDK instance carries
 * the bot's deposited balance and signing key, both of which we want to share
 * across every x402Fetch call in the process.
 *
 * Before this process can make gasless payments, the bot wallet must have
 * deposited USDC into the Gateway Wallet contract (see scripts/gateway-deposit.ts).
 */
let cached: GatewayClient | null = null

export function getGatewayClient(): GatewayClient {
  if (cached) return cached
  if (!config.BOT_PRIVATE_KEY) {
    throw new Error(
      "BOT_PRIVATE_KEY is required for Circle Gateway buyer — set it in env and run `npm run gateway:deposit` once.",
    )
  }
  installFetchShim()
  cached = new GatewayClient({
    chain: "arcTestnet",
    privateKey: config.BOT_PRIVATE_KEY as `0x${string}`,
  })
  return cached
}

export type X402Response<T> = {
  data: T
  /**
   * Circle Gateway transfer id. In the immediate response this is the facilitator's
   * internal id — the actual Arc settlement tx hash is backfilled later by the
   * gateway-poller (status → completed).
   */
  transferId: string
  amountMicroUsdc: bigint
  /** HTTP status code from the resource (200 on success). */
  status: number
}

export type X402FetchInit = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Execute a gasless x402 payment against a Gateway-compatible resource URL.
 *
 * Under the hood, Circle's GatewayClient:
 *   1. issues the initial request,
 *   2. handles the 402 response,
 *   3. signs an EIP-3009 authorization against the Gateway Wallet contract
 *      (NOT the USDC token — signature targets Circle's batching wallet),
 *   4. retries with the signed header, and
 *   5. returns immediately once the facilitator accepts the authorization.
 *
 * The real on-chain batch settlement happens asynchronously on Circle's side;
 * we observe it through `GatewayClient.searchTransfers` in the poller.
 */
export async function x402Fetch<T>(
  url: string,
  init: X402FetchInit = {},
): Promise<X402Response<T>> {
  const c = getGatewayClient()

  // The SDK accepts `unknown` for body; if the caller pre-stringified JSON
  // (legacy pattern), parse it back so the SDK can serialize it itself and set
  // the right Content-Type.
  let body: unknown = init.body
  if (typeof body === "string") {
    try {
      body = JSON.parse(body)
    } catch {
      // leave as-is; SDK will pass through
    }
  }

  try {
    const result = await c.pay<T>(url, {
      method: init.method ?? "GET",
      body,
      headers: init.headers,
    })

    console.log(`x402Fetch pay url ${url} success: transferId=${result.transaction}, status=${result.status}`)

    return {
      data: result.data,
      transferId: result.transaction ?? "",
      amountMicroUsdc: BigInt(result.amount ?? 0n),
      status: result.status,
    }
  } catch (err: any) {
    // Circle's GatewayClient sometimes swallows the facilitator's error body
    // into a generic "Payment processing error". Surface whatever extra context
    // we can reach so callers (and logs) see the real reason.
    const details: Record<string, unknown> = {
      url,
      method: init.method ?? "GET",
    }
    // console.log("x402Fetch pay url", url, "err:", err)
    for (const k of [
      "status",
      "statusCode",
      "code",
      "cause",
      "response",
      "body",
      "data",
      "errorReason",
      "invalidReason",
    ]) {
      const v = err?.[k]
      if (v !== undefined) details[k] = typeof v === "object" ? safeJson(v) : v
    }
    // console.warn("[x402Fetch] Gateway pay failed:", err?.message ?? err, details)
    throw err
  }
}

function safeJson(v: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(v))
  } catch {
    return String(v)
  }
}
