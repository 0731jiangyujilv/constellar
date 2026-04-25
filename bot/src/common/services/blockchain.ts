import { getAddress } from "viem"
import { config } from "../config"
import {
  getPublicClient,
  getWalletClient,
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_IDS,
  getChainConfig,
  type ChainConfig,
} from "../chains"

// Re-export chain utilities for convenience
export { getPublicClient, getWalletClient, SUPPORTED_CHAINS, SUPPORTED_CHAIN_IDS, getChainConfig }
export type { ChainConfig }

// Default chain clients (backward compat — uses the first configured chain, typically Base Sepolia)
const defaultChainId = SUPPORTED_CHAIN_IDS[0] ?? 84532
export const publicClient = getPublicClient(defaultChainId)
export const walletClient = getWalletClient(defaultChainId)

export const BetFactoryAbi = [
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidDuration", inputs: [] },
  { type: "error", name: "UnsupportedAsset", inputs: [] },
  { type: "error", name: "InvalidToken", inputs: [] },
  {
    type: "function",
    name: "priceOracleFactory",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setPriceOracleFactory",
    inputs: [{ name: "newFactory", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getBet",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBetCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPriceFeed",
    inputs: [{ name: "asset", type: "string" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BetCreated",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "betContract", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "asset", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PriceOracleFactoryUpdated",
    inputs: [
      { name: "oldFactory", type: "address", indexed: true },
      { name: "newFactory", type: "address", indexed: true },
    ],
  },
] as const

export const BetAbi = [
  { type: "error", name: "InvalidStatus", inputs: [] },
  { type: "error", name: "BettingClosed", inputs: [] },
  { type: "error", name: "AlreadyPlaced", inputs: [] },
  { type: "error", name: "AmountTooLow", inputs: [] },
  { type: "error", name: "AmountTooHigh", inputs: [] },
  { type: "error", name: "BetNotExpired", inputs: [] },
  { type: "error", name: "NothingToClaim", inputs: [] },
  { type: "error", name: "AlreadyClaimed", inputs: [] },
  { type: "error", name: "NotAPlayer", inputs: [] },
  { type: "error", name: "OracleStalePrice", inputs: [] },
  { type: "error", name: "OracleInvalidPrice", inputs: [] },
  { type: "error", name: "TimelockNotExpired", inputs: [] },
  { type: "error", name: "InvalidFee", inputs: [] },
  { type: "error", name: "LockRequiresBothSides", inputs: [] },
  { type: "error", name: "BetContested", inputs: [] },
  { type: "error", name: "BettingNotClosed", inputs: [] },
  { type: "error", name: "OnlyAdmin", inputs: [] },
  { type: "error", name: "OnlyFactory", inputs: [] },
  { type: "error", name: "InvalidSide", inputs: [] },
  { type: "error", name: "InvalidInitialBet", inputs: [] },
  { type: "error", name: "SecondBetMustOpposeInitiator", inputs: [] },
  { type: "error", name: "SecondBetAmountTooLow", inputs: [] },
  {
    type: "function",
    name: "asset",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "status",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "endTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bettingDeadline",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalUp",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalDown",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "creator",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "priceFeed",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getBetInfo",
    inputs: [],
    outputs: [
      {
        name: "info",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "token", type: "address" },
          { name: "minAmount", type: "uint256" },
          { name: "maxAmount", type: "uint256" },
          { name: "duration", type: "uint256" },
          { name: "bettingDeadline", type: "uint256" },
          { name: "priceFeed", type: "address" },
          { name: "startPrice", type: "int256" },
          { name: "endPrice", type: "int256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "winningSide", type: "uint8" },
          { name: "isDraw", type: "bool" },
          { name: "totalUp", type: "uint256" },
          { name: "totalDown", type: "uint256" },
          { name: "prizePool", type: "uint256" },
          { name: "feeBps", type: "uint256" },
          { name: "feeRecipient", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lock",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "expire",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "placeBet",
    inputs: [
      { name: "side", type: "uint8" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "admin",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "token",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasPlaced",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalPlayers",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimFor",
    inputs: [{ name: "player", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimable",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasClaimed",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUpPositions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getDownPositions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BetLocked",
    inputs: [
      { name: "startPrice", type: "int256", indexed: false },
      { name: "startTime", type: "uint256", indexed: false },
      { name: "endTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BetSettled",
    inputs: [
      { name: "winningSide", type: "uint8", indexed: false },
      { name: "isDraw", type: "bool", indexed: false },
      { name: "endPrice", type: "int256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeesCollected",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BetExpired",
    inputs: [{ name: "refundedTotal", type: "uint256", indexed: false }],
  },
] as const

export const PriceOracleAbi = [
  { type: "error", name: "UnauthorizedReporter", inputs: [] },
  { type: "error", name: "InvalidPrice", inputs: [] },
  { type: "error", name: "RoundNotAvailable", inputs: [] },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reportPrice",
    inputs: [{ name: "answer", type: "int256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

export const PriceOracleFactoryAbi = [
  {
    type: "function",
    name: "getOracle",
    inputs: [{ name: "asset", type: "string" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOracleInfo",
    inputs: [{ name: "asset", type: "string" }],
    outputs: [
      {
        name: "info",
        type: "tuple",
        components: [
          { name: "asset", type: "string" },
          { name: "oracle", type: "address" },
          { name: "decimals", type: "uint8" },
          { name: "description", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOracleCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getOracleInfoAt",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      {
        name: "info",
        type: "tuple",
        components: [
          { name: "asset", type: "string" },
          { name: "oracle", type: "address" },
          { name: "decimals", type: "uint8" },
          { name: "description", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createOracle",
    inputs: [
      { name: "asset", type: "string" },
      { name: "decimals_", type: "uint8" },
      { name: "description_", type: "string" },
    ],
    outputs: [{ name: "oracle", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addOracle",
    inputs: [
      { name: "asset", type: "string" },
      { name: "oracle", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateOracle",
    inputs: [
      { name: "asset", type: "string" },
      { name: "newOracle", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeOracle",
    inputs: [{ name: "asset", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setOracleReporter",
    inputs: [
      { name: "asset", type: "string" },
      { name: "reporter", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setOracleDescription",
    inputs: [
      { name: "asset", type: "string" },
      { name: "description_", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const

// Chain-aware helper functions

export async function getBetCount(chainId?: number): Promise<bigint> {
  const cid = chainId ?? defaultChainId
  const chainCfg = getChainConfig(cid)
  if (!chainCfg) throw new Error(`Unsupported chain: ${cid}`)

  return getPublicClient(cid).readContract({
    address: getAddress(chainCfg.betFactoryAddress),
    abi: BetFactoryAbi,
    functionName: "getBetCount",
  })
}

export async function getBetAddress(betId: number, chainId?: number): Promise<string> {
  const cid = chainId ?? defaultChainId
  const chainCfg = getChainConfig(cid)
  if (!chainCfg) throw new Error(`Unsupported chain: ${cid}`)

  const addr = await getPublicClient(cid).readContract({
    address: getAddress(chainCfg.betFactoryAddress),
    abi: BetFactoryAbi,
    functionName: "getBet",
    args: [BigInt(betId)],
  })
  return addr
}

export async function getBetInfo(betAddress: string, chainId?: number) {
  const cid = chainId ?? defaultChainId
  return getPublicClient(cid).readContract({
    address: getAddress(betAddress),
    abi: BetAbi,
    functionName: "getBetInfo",
  })
}

export async function getPriceFeed(asset: string, chainId?: number): Promise<string> {
  const cid = chainId ?? defaultChainId
  const chainCfg = getChainConfig(cid)
  if (!chainCfg) throw new Error(`Unsupported chain: ${cid}`)

  return getPublicClient(cid).readContract({
    address: getAddress(chainCfg.betFactoryAddress),
    abi: BetFactoryAbi,
    functionName: "getPriceFeed",
    args: [asset],
  })
}

// ============================================================
// EventBet ABIs & helpers (fully decoupled from price bets)
// ============================================================

export const EventBetFactoryAbi = [
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidClosingTime", inputs: [] },
  { type: "error", name: "InvalidToken", inputs: [] },
  {
    type: "function",
    name: "createEventBet",
    inputs: [
      { name: "token", type: "address" },
      { name: "minAmount", type: "uint256" },
      { name: "maxAmount", type: "uint256" },
      { name: "closingTime", type: "uint256" },
      { name: "_question", type: "string" },
      { name: "_resolutionSource", type: "string" },
      { name: "initiatorSide", type: "uint8" },
      { name: "initiatorAmount", type: "uint256" },
    ],
    outputs: [
      { name: "betId", type: "uint256" },
      { name: "betContract", type: "address" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEventBet",
    inputs: [{ name: "betId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEventBetCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "EventBetCreated",
    inputs: [
      { name: "betId", type: "uint256", indexed: true },
      { name: "betContract", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: false },
      { name: "token", type: "address", indexed: false },
      { name: "question", type: "string", indexed: false },
    ],
  },
] as const

export const EventBetAbi = [
  { type: "error", name: "InvalidStatus", inputs: [] },
  { type: "error", name: "BettingClosed", inputs: [] },
  { type: "error", name: "AlreadyPlaced", inputs: [] },
  { type: "error", name: "AmountTooLow", inputs: [] },
  { type: "error", name: "AmountTooHigh", inputs: [] },
  { type: "error", name: "EventNotClosed", inputs: [] },
  { type: "error", name: "NothingToClaim", inputs: [] },
  { type: "error", name: "AlreadyClaimed", inputs: [] },
  { type: "error", name: "NotAPlayer", inputs: [] },
  { type: "error", name: "TimelockNotExpired", inputs: [] },
  { type: "error", name: "InvalidFee", inputs: [] },
  { type: "error", name: "InvalidOutcome", inputs: [] },
  {
    type: "function",
    name: "question",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "resolutionSource",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "status",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "closingTime",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bettingDeadline",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "outcome",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "close",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [
      { name: "_outcome", type: "uint8" },
      { name: "reasoning", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimFor",
    inputs: [{ name: "player", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "claimable",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "hasClaimed",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEventBetInfo",
    inputs: [],
    outputs: [
      {
        name: "info",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "token", type: "address" },
          { name: "minAmount", type: "uint256" },
          { name: "maxAmount", type: "uint256" },
          { name: "closingTime", type: "uint256" },
          { name: "bettingDeadline", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "outcome", type: "uint8" },
          { name: "winningSide", type: "uint8" },
          { name: "isDraw", type: "bool" },
          { name: "totalYes", type: "uint256" },
          { name: "totalNo", type: "uint256" },
          { name: "prizePool", type: "uint256" },
          { name: "feeBps", type: "uint256" },
          { name: "feeRecipient", type: "address" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getYesPositions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getNoPositions",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "placeBet",
    inputs: [
      { name: "side", type: "uint8" },
      { name: "amount_", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "BetPlaced",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "side", type: "uint8", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BetClosed",
    inputs: [
      { name: "closingTime", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EventResolved",
    inputs: [
      { name: "outcome", type: "uint8", indexed: false },
      { name: "reasoning", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FeesCollected",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const

export async function getEventBetCount(chainId?: number): Promise<bigint> {
  const cid = chainId ?? defaultChainId
  const chainCfg = getChainConfig(cid)
  if (!chainCfg) throw new Error(`Unsupported chain: ${cid}`)
  if (!chainCfg.eventBetFactoryAddress) throw new Error(`No EventBetFactory on chain ${cid}`)

  return getPublicClient(cid).readContract({
    address: getAddress(chainCfg.eventBetFactoryAddress),
    abi: EventBetFactoryAbi,
    functionName: "getEventBetCount",
  })
}

export async function getEventBetAddress(betId: number, chainId?: number): Promise<string> {
  const cid = chainId ?? defaultChainId
  const chainCfg = getChainConfig(cid)
  if (!chainCfg) throw new Error(`Unsupported chain: ${cid}`)
  if (!chainCfg.eventBetFactoryAddress) throw new Error(`No EventBetFactory on chain ${cid}`)

  return getPublicClient(cid).readContract({
    address: getAddress(chainCfg.eventBetFactoryAddress),
    abi: EventBetFactoryAbi,
    functionName: "getEventBet",
    args: [BigInt(betId)],
  })
}

export async function getEventBetInfo(betAddress: string, chainId?: number) {
  const cid = chainId ?? defaultChainId
  return getPublicClient(cid).readContract({
    address: getAddress(betAddress),
    abi: EventBetAbi,
    functionName: "getEventBetInfo",
  })
}
