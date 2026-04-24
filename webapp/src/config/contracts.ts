import { getChainConfig, DEFAULT_CHAIN_ID } from './chains'

// Chain-aware contract address resolution
export function getContractsForChain(chainId: number) {
  const chainConfig = getChainConfig(chainId)
  const zero = '0x0000000000000000000000000000000000000000' as `0x${string}`
  if (!chainConfig) {
    return {
      betFactoryAddress: zero,
      usdcAddress: zero,
      priceOracleFactoryAddress: zero,
      eventBetFactoryAddress: zero,
    }
  }
  return {
    betFactoryAddress: chainConfig.betFactoryAddress,
    usdcAddress: chainConfig.usdcAddress,
    priceOracleFactoryAddress: chainConfig.priceOracleFactoryAddress,
    eventBetFactoryAddress: chainConfig.eventBetFactoryAddress,
  }
}

// Backward-compatible exports (default chain)
export const BET_FACTORY_ADDRESS = getContractsForChain(DEFAULT_CHAIN_ID).betFactoryAddress
export const USDC_ADDRESS = getContractsForChain(DEFAULT_CHAIN_ID).usdcAddress
import { envConfig } from './env'

export const BET_POR_ADDRESS = envConfig.betPorAddress

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

export const BET_FACTORY_ABI = [
  { type: 'error', name: 'InvalidAmount', inputs: [] },
  { type: 'error', name: 'InvalidDuration', inputs: [] },
  { type: 'error', name: 'UnsupportedAsset', inputs: [] },
  { type: 'error', name: 'InvalidToken', inputs: [] },
  {
    type: 'function',
    name: 'createBet',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'minAmount', type: 'uint256' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
      { name: 'asset', type: 'string' },
      { name: 'initiatorSide', type: 'uint8' },
      { name: 'initiatorAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'betId', type: 'uint256' },
      { name: 'betContract', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBet',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBetCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BetCreated',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true },
      { name: 'betContract', type: 'address', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'asset', type: 'string', indexed: false },
    ],
  },
] as const

export const BET_ABI = [
  { type: 'error', name: 'InvalidStatus', inputs: [] },
  { type: 'error', name: 'BettingClosed', inputs: [] },
  { type: 'error', name: 'AlreadyPlaced', inputs: [] },
  { type: 'error', name: 'AmountTooLow', inputs: [] },
  { type: 'error', name: 'AmountTooHigh', inputs: [] },
  { type: 'error', name: 'BetNotExpired', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'AlreadyClaimed', inputs: [] },
  { type: 'error', name: 'NotAPlayer', inputs: [] },
  { type: 'error', name: 'OracleStalePrice', inputs: [] },
  { type: 'error', name: 'OracleInvalidPrice', inputs: [] },
  { type: 'error', name: 'TimelockNotExpired', inputs: [] },
  { type: 'error', name: 'InvalidFee', inputs: [] },
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimFor',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'asset',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'status',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBetInfo',
    inputs: [],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'minAmount', type: 'uint256' },
          { name: 'maxAmount', type: 'uint256' },
          { name: 'duration', type: 'uint256' },
          { name: 'bettingDeadline', type: 'uint256' },
          { name: 'priceFeed', type: 'address' },
          { name: 'startPrice', type: 'int256' },
          { name: 'endPrice', type: 'int256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'winningSide', type: 'uint8' },
          { name: 'isDraw', type: 'bool' },
          { name: 'totalUp', type: 'uint256' },
          { name: 'totalDown', type: 'uint256' },
          { name: 'prizePool', type: 'uint256' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'feeRecipient', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUpPositions',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDownPositions',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimable',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export const BetStatus = {
  Open: 0,
  Locked: 1,
  Settled: 2,
  Expired: 3,
} as const

export const Side = {
  Up: 0,
  Down: 1,
} as const

export function betStatusLabel(status: number): string {
  switch (status) {
    case BetStatus.Open: return 'Open for Predictions'
    case BetStatus.Locked: return 'Locked'
    case BetStatus.Settled: return 'Settled'
    case BetStatus.Expired: return 'Expired (Refunded)'
    default: return 'Unknown'
  }
}

// ============================================================
// EventBet ABIs (YES/NO event prediction)
// ============================================================

export const EVENT_BET_FACTORY_ABI = [
  { type: 'error', name: 'InvalidAmount', inputs: [] },
  { type: 'error', name: 'InvalidClosingTime', inputs: [] },
  { type: 'error', name: 'InvalidToken', inputs: [] },
  {
    type: 'function',
    name: 'createEventBet',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'minAmount', type: 'uint256' },
      { name: 'maxAmount', type: 'uint256' },
      { name: 'closingTime', type: 'uint256' },
      { name: '_question', type: 'string' },
      { name: '_resolutionSource', type: 'string' },
      { name: 'initiatorSide', type: 'uint8' },
      { name: 'initiatorAmount', type: 'uint256' },
    ],
    outputs: [
      { name: 'betId', type: 'uint256' },
      { name: 'betContract', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getEventBet',
    inputs: [{ name: 'betId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEventBetCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'EventBetCreated',
    inputs: [
      { name: 'betId', type: 'uint256', indexed: true },
      { name: 'betContract', type: 'address', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'question', type: 'string', indexed: false },
    ],
  },
] as const

export const EVENT_BET_ABI = [
  { type: 'error', name: 'InvalidStatus', inputs: [] },
  { type: 'error', name: 'BettingClosed', inputs: [] },
  { type: 'error', name: 'AlreadyPlaced', inputs: [] },
  { type: 'error', name: 'AmountTooLow', inputs: [] },
  { type: 'error', name: 'AmountTooHigh', inputs: [] },
  { type: 'error', name: 'EventNotClosed', inputs: [] },
  { type: 'error', name: 'NothingToClaim', inputs: [] },
  { type: 'error', name: 'AlreadyClaimed', inputs: [] },
  { type: 'error', name: 'NotAPlayer', inputs: [] },
  { type: 'error', name: 'InvalidOutcome', inputs: [] },
  {
    type: 'function',
    name: 'question',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resolutionSource',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'placeBet',
    inputs: [
      { name: 'side', type: 'uint8' },
      { name: 'amount_', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimFor',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getEventBetInfo',
    inputs: [],
    outputs: [
      {
        name: 'info',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'minAmount', type: 'uint256' },
          { name: 'maxAmount', type: 'uint256' },
          { name: 'closingTime', type: 'uint256' },
          { name: 'bettingDeadline', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'outcome', type: 'uint8' },
          { name: 'winningSide', type: 'uint8' },
          { name: 'isDraw', type: 'bool' },
          { name: 'totalYes', type: 'uint256' },
          { name: 'totalNo', type: 'uint256' },
          { name: 'prizePool', type: 'uint256' },
          { name: 'feeBps', type: 'uint256' },
          { name: 'feeRecipient', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getYesPositions',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNoPositions',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimable',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

export const EventBetStatus = {
  Open: 0,
  Closed: 1,
  Settled: 2,
} as const

export const EventSide = {
  Yes: 0,
  No: 1,
} as const

export function eventBetStatusLabel(status: number): string {
  switch (status) {
    case EventBetStatus.Open: return 'Open for Predictions'
    case EventBetStatus.Closed: return 'Closed (Awaiting Resolution)'
    case EventBetStatus.Settled: return 'Settled'
    default: return 'Unknown'
  }
}

export const BET_POR_ABI = [
  {
    type: 'function',
    name: 'getLatestReport',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'totalBets', type: 'uint256' },
          { name: 'activeBets', type: 'uint256' },
          { name: 'settledBets', type: 'uint256' },
          { name: 'totalVolume', type: 'uint256' },
          { name: 'topPlayerProfit', type: 'uint256' },
          { name: 'isValid', type: 'bool' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reportCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const
