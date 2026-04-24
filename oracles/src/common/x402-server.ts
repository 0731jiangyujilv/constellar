import type { Request, Response, NextFunction } from 'express'
import { randomBytes } from 'node:crypto'
import { config } from './config'
import { verifyAndSettleLive } from './x402-live'

export type PaymentContext = {
  txHash: string
  settledAt: number
  amountMicroUsdc: bigint
  payer?: string
}

declare module 'express-serve-static-core' {
  interface Request {
    payment?: PaymentContext
  }
}

type Requirement = {
  amountMicroUsdc: bigint
  payTo: `0x${string}`
  resource?: string
  description?: string
  personaId?: string
}

function buildAcceptBody(req: Request, r: Requirement) {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: config.X402_NETWORK,
        maxAmountRequired: r.amountMicroUsdc.toString(),
        asset: config.USDC_ADDRESS,
        payTo: r.payTo,
        resource: r.resource ?? req.originalUrl,
        description: r.description ?? 'Oracle query fee',
        maxTimeoutSeconds: 30,
      },
    ],
  }
}

/**
 * Decode X-PAYMENT header. In live mode, calls facilitator to verify + settle.
 * In mock mode, short-circuits with a deterministic fake tx hash so dev flows run
 * without real USDC — swap `X402_MODE=live` in env to enable real settlement.
 */
async function verifyAndSettle(paymentHeader: string, r: Requirement): Promise<PaymentContext> {
  if (config.X402_MODE === 'mock') {
    const hash = `0x${randomBytes(32).toString('hex')}`
    return {
      txHash: hash,
      settledAt: Date.now(),
      amountMicroUsdc: r.amountMicroUsdc,
      payer: 'mock-payer',
    }
  }

  // Live mode: decode signed EIP-3009 authorization and settle on Arc ourselves.
  // The oracle is the settlement agent — it pays the (sub-cent) gas with its
  // own Circle Wallet, so the payer (bot) never has to send a tx.
  const result = await verifyAndSettleLive(paymentHeader, {
    amountMicroUsdc: r.amountMicroUsdc,
    payTo: r.payTo,
    personaId: r.personaId,
  })
  return {
    txHash: result.txHash,
    settledAt: Date.now(),
    amountMicroUsdc: result.amountMicroUsdc,
    payer: result.payer,
  }
}

export function requirePayment(req: Requirement) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const header = request.header('X-PAYMENT')
    if (!header) {
      response.status(402).json(buildAcceptBody(request, req))
      return
    }

    try {
      const ctx = await verifyAndSettle(header, req)
      request.payment = ctx
      response.setHeader('X-PAYMENT-RESPONSE', Buffer.from(JSON.stringify({ txHash: ctx.txHash })).toString('base64'))
      next()
    } catch (err: any) {
      const reason = err?.message ?? 'payment verification failed'
      console.error(`[x402] ${request.method} ${request.originalUrl} verify/settle failed in ${config.X402_MODE} mode: ${reason}`)
      response.status(402).json({
        ...buildAcceptBody(request, req),
        error: reason,
        mode: config.X402_MODE,
      })
    }
  }
}
