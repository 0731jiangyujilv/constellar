import { type Chain } from 'viem'
import { baseSepolia, base } from 'viem/chains'
import { envConfig, type WebappChainEntry } from './env'

export type ChainConfig = {
  chain: Chain
  betFactoryAddress: `0x${string}`
  usdcAddress: `0x${string}`
  priceOracleFactoryAddress: `0x${string}`
  explorerUrl: string
  isTestnet: boolean
  eventBetFactoryAddress: `0x${string}`
}

// Custom chain definition for Arc Testnet (placeholder — update when details are available)
export const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://arc-testnet.drpc.org'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
}

// Map chainId -> viem Chain object
const viemChains: Record<number, Chain> = {
  [baseSepolia.id]: baseSepolia,
  [base.id]: base,
  [arcTestnet.id]: arcTestnet,
}

// Build SUPPORTED_CHAINS from env config
function buildChains(): Record<number, ChainConfig> {
  const result: Record<number, ChainConfig> = {}

  for (const [idStr, entry] of Object.entries(envConfig.chains) as Array<[string, WebappChainEntry]>) {
    const chainId = Number(idStr)
    const viemChain = viemChains[chainId]
    if (!viemChain) continue

    result[chainId] = {
      chain: viemChain,
      betFactoryAddress: entry.betFactoryAddress,
      usdcAddress: entry.usdcAddress,
      priceOracleFactoryAddress: entry.priceOracleFactoryAddress,
      explorerUrl: entry.explorerUrl,
      isTestnet: entry.isTestnet,
      eventBetFactoryAddress: entry.eventBetFactoryAddress,
    }
  }

  return result
}

export const SUPPORTED_CHAINS = buildChains()
export const SUPPORTED_CHAIN_IDS = Object.keys(SUPPORTED_CHAINS).map(Number)
export const SUPPORTED_CHAIN_LIST = Object.values(SUPPORTED_CHAINS)

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId]
}

export function isSupportedChain(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS
}

// Default chain for new users
export const DEFAULT_CHAIN_ID = baseSepolia.id
