export const NATIVE_ETH_SENTINEL = '0x0000000000000000000000000000000000000000' as const

export const UNISWAP_SUPPORTED_CHAIN_IDS = [8453] as const

export const DEFAULT_SLIPPAGE_PERCENT = '0.5'
export const STABLE_SLIPPAGE_PERCENT = '0.5'
export const VOLATILE_SLIPPAGE_PERCENT = '1.0'

export const ETH_GAS_BUFFER_WEI = 500_000_000_000_000n

export const QUOTE_STALE_MS = 25_000

export const HIGH_PRICE_IMPACT_PERCENT = 3

// Mirrors bot's UNISWAP_FEE_BPS. Used to gross up the requested output so the
// swapper receives the displayed USDC amount after the integrator fee.
const rawFeeBps = Number(import.meta.env.VITE_UNISWAP_FEE_BPS ?? '0')
export const INTEGRATOR_FEE_BPS: number = Number.isFinite(rawFeeBps) && rawFeeBps > 0 && rawFeeBps < 10_000 ? Math.floor(rawFeeBps) : 0

export function grossUpForFee(amount: bigint): bigint {
  if (INTEGRATOR_FEE_BPS <= 0 || amount <= 0n) return amount
  const denom = 10_000n - BigInt(INTEGRATOR_FEE_BPS)
  return (amount * 10_000n + denom - 1n) / denom
}

export type SwappableToken = {
  symbol: string
  address: `0x${string}`
  decimals: number
  isNative: boolean
  isStable: boolean
}

export const SWAPPABLE_TOKENS_BASE: SwappableToken[] = [
  { symbol: 'ETH',  address: NATIVE_ETH_SENTINEL,                            decimals: 18, isNative: true,  isStable: false },
  { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006',   decimals: 18, isNative: false, isStable: false },
  { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',   decimals: 6,  isNative: false, isStable: true  },
  { symbol: 'DAI',  address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',   decimals: 18, isNative: false, isStable: true  },
]

export function slippageFor(token: SwappableToken): string {
  return token.isStable ? STABLE_SLIPPAGE_PERCENT : VOLATILE_SLIPPAGE_PERCENT
}
