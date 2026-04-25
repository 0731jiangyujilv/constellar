import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'
import { config } from './config'
import type { OraclePersona } from './types'

/**
 * Payment context we expose to route handlers. Sourced from Circle Gateway's
 * middleware (req.payment after successful settle) — each field flows through
 * to the bot's nanopay registry for UI grouping and status tracking.
 */
export type PaymentContext = {
  payer: string
  amountAtomic: string
  amountUsdc: number
  network: string
  /** Circle transfer id (or batch settlement tx hash once `completed`). */
  transferId: string | null
  /** Per-round batch correlation id, threaded by the buyer in `X-Batch-Id`. */
  batchId: string | null
}

declare module 'express-serve-static-core' {
  interface Request {
    payment?: PaymentContext
  }
}

type GatewayPaymentShape = {
  verified?: boolean
  payer?: string
  amount?: string
  network?: string
  transaction?: string
}

const DEFAULT_FACILITATOR = 'https://gateway-api-testnet.circle.com'
const ARC_TESTNET_CAIP2 = 'eip155:5042002'

// One middleware factory per persona — sellerAddress goes directly to the
// persona's wallet so Gateway routes settled USDC into that oracle's balance.
function makeGateway(persona: OraclePersona) {
  const facilitatorUrl =
    (config.X402_FACILITATOR_URL || DEFAULT_FACILITATOR).replace(/\/$/, '')

  return createGatewayMiddleware({
    sellerAddress: persona.walletAddress,
    networks: [ARC_TESTNET_CAIP2],
    facilitatorUrl,
    description: `${persona.name} oracle query`,
  })
}

/**
 * Build a route-level middleware that:
 *  1. runs Circle Gateway's `require(price)` middleware (handles 402, verifies,
 *     settles via facilitator; populates res/req with payment info),
 *  2. normalizes `req.payment` into our `PaymentContext` (pulls `X-Batch-Id`
 *     from the request headers for batch grouping in the swarm UI).
 *
 * `price` must be a Circle-compatible dollar string like `'$0.001'`.
 */
export function requirePayment(
  persona: OraclePersona,
  price: string,
): RequestHandler[] {
  const gateway = makeGateway(persona)
  const innerMiddleware = gateway.require(price) as unknown as RequestHandler

  // Wrap the gateway middleware so we LOG every non-2xx response body it
  // writes back. Circle's middleware catches the underlying error.message but
  // never logs it — so when settle() throws (network blip, bad facilitator,
  // missing buyer deposit, etc.) the operator sees nothing in the seller log
  // and the buyer just sees "Payment processing error".
  const gatewayMiddleware: RequestHandler = (req, res, next) => {
    const originalEnd = res.end.bind(res)
    res.end = ((chunk?: any, encoding?: any, cb?: any) => {
      if (res.statusCode >= 400 && chunk) {
        try {
          const text =
            typeof chunk === 'string'
              ? chunk
              : Buffer.isBuffer(chunk)
                ? chunk.toString('utf8')
                : String(chunk)
          if (text) {
            console.warn(
              `[${persona.dataSource}] gateway middleware → ${res.statusCode} ${req.method} ${req.url}\n  body: ${text.slice(0, 600)}`,
            )
          }
        } catch {
          // ignore log shim failures
        }
      }
      return originalEnd(chunk, encoding, cb)
    }) as typeof res.end
    return innerMiddleware(req, res, next)
  }

  const annotate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    const raw = (req as unknown as { payment?: GatewayPaymentShape }).payment
    if (!raw) {
      next()
      return
    }
    const amountAtomic = raw.amount ?? '0'
    const amountUsdc = Number(amountAtomic) / 1_000_000
    const batchHeader = req.header('X-Batch-Id') ?? req.header('x-batch-id')
    req.payment = {
      payer: raw.payer ?? 'unknown',
      amountAtomic,
      amountUsdc,
      network: raw.network ?? ARC_TESTNET_CAIP2,
      transferId: raw.transaction ?? null,
      batchId: batchHeader ?? null,
    }
    next()
  }

  return [gatewayMiddleware, annotate]
}
