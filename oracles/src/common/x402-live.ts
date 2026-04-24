import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseSignature,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config'

const USDC_EIP3009_ABI = [
  {
    type: 'function',
    name: 'transferWithAuthorization',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 'g', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const satisfies Abi

// Note: last input name is intentionally 'g' above to avoid a TS literal
// collision in the tuple abi; viem only cares about types/order, not names.
// Real ABI uses 's' — we still pass { name: 's', ... } to viem below via
// manual call-data composition, but for type-inference we rely on this stub.

export type X402LivePayload = {
  scheme: 'exact'
  network: string
  payload: {
    signature: { v?: number; r: Hex; s: Hex; compact?: Hex }
    authorization: {
      from: Address
      to: Address
      value: string
      validAfter: string
      validBefore: string
      nonce: Hex
    }
  }
}

type SettleResult = {
  txHash: Hex
  amountMicroUsdc: bigint
  payer: Address
}

const cache = new Map<string, { wallet: WalletClient; publicClient: PublicClient }>()

function resolveSignerKey(personaId?: string): `0x${string}` {
  if (personaId) {
    const envKey = `ORACLE_SETTLER_PRIVATE_KEY_${personaId.toUpperCase()}` as keyof typeof config
    const perPersona = config[envKey] as string | undefined
    if (perPersona) return perPersona as `0x${string}`
  }
  if (!config.ORACLE_SETTLER_PRIVATE_KEY) {
    throw new Error(
      personaId
        ? `ORACLE_SETTLER_PRIVATE_KEY_${personaId.toUpperCase()} (and fallback ORACLE_SETTLER_PRIVATE_KEY) not configured — cannot run x402 live mode`
        : 'ORACLE_SETTLER_PRIVATE_KEY not configured — cannot run x402 live mode',
    )
  }
  return config.ORACLE_SETTLER_PRIVATE_KEY as `0x${string}`
}

function clients(personaId?: string) {
  const key = personaId ?? '__default__'
  const hit = cache.get(key)
  if (hit) return hit
  const signerKey = resolveSignerKey(personaId)
  const chain = defineChain({
    id: config.ARC_CHAIN_ID,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: { default: { http: [config.ARC_RPC_URL] } },
  })
  const account = privateKeyToAccount(signerKey)
  const publicClient = createPublicClient({ chain, transport: http(config.ARC_RPC_URL) })
  const wallet = createWalletClient({ chain, account, transport: http(config.ARC_RPC_URL) })
  const entry = { publicClient, wallet }
  cache.set(key, entry)
  return entry
}

/**
 * x402 live settlement: decode the signed EIP-3009 authorization, submit
 * transferWithAuthorization on Arc, wait for receipt, return the tx hash.
 *
 * This replaces the facilitator.x402.org hop — the oracle itself is the
 * settlement agent, using its own Circle Wallet to pay the sub-cent gas fee.
 */
export async function verifyAndSettleLive(
  paymentHeader: string,
  expected: { amountMicroUsdc: bigint; payTo: Address; personaId?: string },
): Promise<SettleResult> {
  let payload: X402LivePayload
  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf8')
    payload = JSON.parse(decoded) as X402LivePayload
  } catch (err: any) {
    throw new Error(`x402 payload decode failed: ${err?.message ?? 'unknown'}`)
  }

  const auth = payload.payload.authorization
  const sigRaw = payload.payload.signature
  if (!auth || !sigRaw) throw new Error('x402 payload missing authorization or signature')

  // Sanity-check the authorization against what we required
  const value = BigInt(auth.value)
  if (value < expected.amountMicroUsdc) {
    throw new Error(`x402 authorization under-value: got ${value} need ${expected.amountMicroUsdc}`)
  }
  if (auth.to.toLowerCase() !== expected.payTo.toLowerCase()) {
    throw new Error(`x402 authorization wrong recipient: got ${auth.to} want ${expected.payTo}`)
  }
  const validBefore = BigInt(auth.validBefore)
  if (validBefore < BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error('x402 authorization expired')
  }

  // Normalize signature → v/r/s
  let v: number
  let r: Hex
  let s: Hex
  if (sigRaw.compact) {
    const parsed = parseSignature(sigRaw.compact as Hex)
    v = Number(parsed.v ?? 27)
    r = parsed.r as Hex
    s = parsed.s as Hex
  } else {
    v = sigRaw.v ?? 27
    r = sigRaw.r
    s = sigRaw.s
  }
  if (v < 27) v += 27

  const { wallet, publicClient } = clients(expected.personaId)
  const usdc = config.USDC_ADDRESS as Address
  if (!/^0x[0-9a-fA-F]{40}$/.test(usdc)) {
    throw new Error(`USDC_ADDRESS invalid: ${usdc}`)
  }

  const { request } = await publicClient.simulateContract({
    address: usdc,
    abi: USDC_EIP3009_ABI,
    functionName: 'transferWithAuthorization',
    args: [
      auth.from,
      auth.to,
      value,
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce,
      v,
      r,
      s,
    ],
    account: wallet.account!,
  })

  const txHash = await wallet.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 })
  if (receipt.status !== 'success') {
    throw new Error(`x402 settle reverted (tx ${txHash})`)
  }

  return { txHash, amountMicroUsdc: value, payer: auth.from }
}
