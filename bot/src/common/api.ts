import express from "express"
import cors from "cors"
import { prisma } from "./db"
import { getPriceFeed } from "./services/blockchain"
import { fetchAssetPriceQuote } from "./services/market-data"
import { generateNonce, verifySiweMessage, createSessionToken, deleteSession } from "./services/auth"
import { requireAuth, optionalAuth } from "./middleware/auth"
import { isSupportedChain, SUPPORTED_CHAINS, SUPPORTED_CHAIN_IDS } from "./chains"
import * as uniswapProxy from "./uniswapProxy"
import { config } from "./config"
import { swarmRouter } from "./routes/swarm"

export const app = express()
app.use(cors())
app.use(express.json())

// Oracle swarm telemetry (heartbeats + SSE stream)
app.use("/api/swarm", swarmRouter)

// ---------- Health & Info ----------

app.get("/health", (_req, res) => {
  res.json({ status: "ok" })
})

app.get("/api/chains", (_req, res) => {
  const chains = Object.values(SUPPORTED_CHAINS).map((c) => ({
    chainId: c.chainId,
    name: c.name,
    isTestnet: c.isTestnet,
    explorerUrl: c.explorerUrl,
  }))
  res.json(chains)
})

// ---------- SIWE Authentication ----------

app.get("/api/auth/nonce", async (_req, res) => {
  try {
    const nonce = await generateNonce()
    res.json({ nonce })
  } catch (err) {
    console.error("nonce error:", err)
    res.status(500).json({ error: "Failed to generate nonce" })
  }
})

app.post("/api/auth/verify", async (req, res) => {
  try {
    const { message, signature } = req.body
    if (!message || !signature) {
      res.status(400).json({ error: "message and signature required" })
      return
    }

    const { address, chainId } = await verifySiweMessage(message, signature)
    const { token, expiresAt } = await createSessionToken(address, chainId)

    res.json({ token, address, chainId, expiresAt: expiresAt.toISOString() })
  } catch (err: any) {
    console.error("auth verify error:", err)
    res.status(401).json({ error: err.message || "Verification failed" })
  }
})

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    address: req.user!.address,
    chainId: req.user!.chainId,
  })
})

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    await deleteSession(req.user!.sessionId)
    res.json({ success: true })
  } catch (err) {
    console.error("logout error:", err)
    res.status(500).json({ error: "Logout failed" })
  }
})

// ---------- Helper: parse chainId from request ----------

function parseChainId(req: express.Request): number {
  const raw = req.query.chainId || req.params.chainId || req.body?.chainId
  if (!raw) return 84532 // default
  const cid = parseInt(String(raw))
  return isNaN(cid) ? 84532 : cid
}

function validateChainId(res: express.Response, chainId: number): boolean {
  if (!isSupportedChain(chainId)) {
    res.status(400).json({
      error: `Unsupported chain: ${chainId}`,
      supportedChains: SUPPORTED_CHAIN_IDS,
    })
    return false
  }
  return true
}

// ---------- Bet Queries ----------

app.get("/api/bet/:id", async (req, res) => {
  try {
    const bet = await prisma.bet.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { positions: true },
    })
    if (!bet) {
      res.status(404).json({ error: "Bet not found" })
      return
    }
    res.json(serializeBet(bet))
  } catch (err) {
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/bet/uuid/:uuid", async (req, res) => {
  try {
    const bet = await prisma.bet.findUnique({
      where: { uuid: req.params.uuid },
      include: { positions: true },
    })
    if (!bet) {
      res.status(404).json({ error: "Bet not found" })
      return
    }
    res.json(serializeBet(bet))
  } catch (err) {
    res.status(500).json({ error: "Internal server error" })
  }
})

// Chain-aware contract address lookup
app.get("/api/bet/contract/:chainId/:address", async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId)
    const bet = await prisma.bet.findFirst({
      where: { contractAddress: req.params.address, chainId },
      include: { positions: true },
    })
    if (!bet) {
      res.status(404).json({ error: "Bet not found" })
      return
    }
    res.json(serializeBet(bet))
  } catch (err) {
    res.status(500).json({ error: "Internal server error" })
  }
})

// Backward compat: contract lookup without chainId (searches all chains)
app.get("/api/bet/contract/:address", async (req, res) => {
  try {
    const bet = await prisma.bet.findFirst({
      where: { contractAddress: req.params.address },
      include: { positions: true },
    })
    if (!bet) {
      res.status(404).json({ error: "Bet not found" })
      return
    }
    res.json(serializeBet(bet))
  } catch (err) {
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/user/:tgId/bets", async (req, res) => {
  try {
    const tgId = BigInt(req.params.tgId)
    const chainId = parseChainId(req)
    const positions = await prisma.position.findMany({
      where: { tgId, chainId },
      select: { betId: true },
    })
    const positionBetIds = positions.map((p) => p.betId)

    const bets = await prisma.bet.findMany({
      where: {
        chainId,
        OR: [
          { creatorTgId: tgId },
          { id: { in: positionBetIds } },
        ],
      },
      include: { positions: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    res.json(bets.map(serializeBet))
  } catch (err) {
    res.status(500).json({ error: "Internal server error" })
  }
})

// ---------- Asset / Oracle ----------

app.get("/api/asset/:asset", async (req, res) => {
  try {
    const asset = decodeURIComponent(req.params.asset)
    const chainId = parseChainId(req)
    if (!validateChainId(res, chainId)) return

    const oracle = await prisma.oracleRegistry.findUnique({
      where: { chainId_asset: { chainId, asset } },
    })
    if (oracle?.isActive) {
      res.json({ asset, chainId, supported: true, priceFeed: oracle.oracleAddress, source: "registry" })
      return
    }

    const feed = await getPriceFeed(asset, chainId)
    const supported = feed !== "0x0000000000000000000000000000000000000000"
    res.json({ asset, chainId, supported, priceFeed: feed, source: "factory" })
  } catch (err) {
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/price/:asset", async (req, res) => {
  try {
    const asset = decodeURIComponent(req.params.asset)
    const quote = await fetchAssetPriceQuote(asset)
    res.json({
      asset: quote.asset,
      coinGeckoId: quote.coinGeckoId,
      price: quote.price,
      timestamp: Date.now(),
    })
  } catch (err) {
    console.error("price fetch error:", err)
    res.status(500).json({ error: "Failed to fetch price" })
  }
})

app.get("/api/oracles", async (req, res) => {
  try {
    const chainId = parseChainId(req)
    const oracles = await prisma.oracleRegistry.findMany({
      where: { isActive: true, chainId },
      orderBy: { asset: "asc" },
    })

    res.json(oracles)
  } catch (error) {
    console.error("oracle list error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ---------- Wallet Registration ----------

app.post("/api/register-wallet", async (req, res) => {
  try {
    const { tgId, walletAddress } = req.body

    if (!tgId || !walletAddress) {
      res.status(400).json({ error: "tgId and walletAddress required" })
      return
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      res.status(400).json({ error: "Invalid wallet address" })
      return
    }

    const tgIdBigInt = BigInt(tgId)

    await prisma.user.upsert({
      where: { tgId: tgIdBigInt },
      update: { walletAddress: walletAddress.toLowerCase() },
      create: { tgId: tgIdBigInt, walletAddress: walletAddress.toLowerCase() },
    })

    res.json({ success: true })
  } catch (err) {
    console.error("register-wallet error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ---------- On-Chain Created Notification ----------

app.post("/api/bet/:id/on-chain-created", async (req, res) => {
  try {
    const betId = parseInt(req.params.id)
    const { contractAddress, onChainBetId, txHash, chainId: bodyChainId } = req.body

    if (!contractAddress) {
      res.status(400).json({ error: "contractAddress required" })
      return
    }

    const bet = await prisma.bet.findUnique({ where: { id: betId } })
    if (!bet) {
      res.status(404).json({ error: "Bet not found" })
      return
    }

    const chainId = bodyChainId ? parseInt(bodyChainId) : bet.chainId

    // If already updated with this onChainBetId, skip (idempotent)
    if (bet.betId !== null && bet.betId === parseInt(onChainBetId || "0")) {
      console.log(`[API] Bet #${betId} already has onChainBetId ${onChainBetId}, skipping update`)
      res.json({ success: true, alreadyUpdated: true })
      return
    }

    // Check if another row already owns this onChainBetId on the same chain
    const parsedOnChainId = onChainBetId ? parseInt(onChainBetId) : null
    if (parsedOnChainId !== null) {
      const conflict = await prisma.bet.findFirst({
        where: { betId: parsedOnChainId, chainId, id: { not: betId } },
      })
      if (conflict) {
        console.warn(`[API] onChainBetId ${parsedOnChainId} on chain ${chainId} already used by DB bet #${conflict.id}, clearing stale row`)
        await prisma.bet.update({
          where: { id: conflict.id },
          data: { betId: null },
        })
      }
    }

    await prisma.bet.update({
      where: { id: betId },
      data: {
        contractAddress,
        betId: parsedOnChainId,
        chainId,
        status: "OPEN",
        txHash,
      },
    })

    res.json({ success: true })
  } catch (err) {
    console.error("on-chain-created error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ---------- Stats ----------

app.get("/api/stats", async (req, res) => {
  try {
    const chainId = req.query.chainId ? parseInt(String(req.query.chainId)) : undefined
    const chainFilter = chainId ? { chainId } : {}

    const [totalBets, activeBets, settledBets, cancelledBets, volumeData] = await Promise.all([
      prisma.bet.count({ where: chainFilter }),
      prisma.bet.count({ where: { status: { in: ["OPEN", "LOCKED"] }, ...chainFilter } }),
      prisma.bet.count({ where: { status: "SETTLED", ...chainFilter } }),
      prisma.bet.count({ where: { status: "CANCELLED", ...chainFilter } }),
      prisma.position.aggregate({
        _sum: { amount: true },
        where: chainId ? { chainId } : undefined,
      }),
    ])

    const totalVolume = volumeData._sum.amount?.toString() || "0"

    res.json({
      chainId: chainId || "all",
      activeBetsCount: activeBets,
      totalBetsCount: totalBets,
      totalVolume,
      settledBetsCount: settledBets,
      cancelledBetsCount: cancelledBets,
    })
  } catch (err) {
    console.error("stats error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/stats/leaderboard", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const chainId = req.query.chainId ? parseInt(String(req.query.chainId)) : undefined
    const chainFilter = chainId ? { chainId } : {}

    const settledBets = await prisma.bet.findMany({
      where: { status: "SETTLED", ...chainFilter },
      include: { positions: { include: { user: true } } },
    })

    const userStats = new Map<string, {
      username: string
      wins: number
      losses: number
      totalProfit: number
      totalBets: number
    }>()

    for (const bet of settledBets) {
      for (const position of bet.positions) {
        const userId = position.tgId.toString()
        const username = position.user.username || `User${userId.slice(-6)}`

        if (!userStats.has(userId)) {
          userStats.set(userId, {
            username,
            wins: 0,
            losses: 0,
            totalProfit: 0,
            totalBets: 0,
          })
        }

        const stats = userStats.get(userId)!
        stats.totalBets++

        const positionAmount = parseFloat(position.amount.toString())
        const totalUp = parseFloat(bet.totalUp.toString())
        const totalDown = parseFloat(bet.totalDown.toString())

        if (bet.isDraw) {
          continue
        }

        const isWinner = position.side === bet.winningSide
        if (isWinner) {
          stats.wins++
          const totalPool = totalUp + totalDown
          const winningPool = position.side === "UP" ? totalUp : totalDown
          const payout = (positionAmount / winningPool) * totalPool
          stats.totalProfit += payout - positionAmount
        } else {
          stats.losses++
          stats.totalProfit -= positionAmount
        }
      }
    }

    const leaderboard = Array.from(userStats.values())
      .map(stats => ({
        username: stats.username,
        wins: stats.wins,
        losses: stats.losses,
        totalProfit: stats.totalProfit.toFixed(6),
        winRate: stats.totalBets > 0 ? (stats.wins / stats.totalBets) * 100 : 0,
        totalBets: stats.totalBets,
      }))
      .sort((a, b) => parseFloat(b.totalProfit) - parseFloat(a.totalProfit))
      .slice(0, limit)

    res.json(leaderboard)
  } catch (err) {
    console.error("leaderboard error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ---------- Serialization ----------

function serializeBet(bet: any) {
  const result: any = { ...bet }
  result.source = "telegram"

  if (result.creatorTgId !== undefined) result.creatorTgId = String(result.creatorTgId)
  if (result.chatId !== undefined) result.chatId = String(result.chatId)
  if (result.messageId !== undefined) result.messageId = result.messageId ? String(result.messageId) : null
  if (result.minAmount !== undefined) result.minAmount = String(result.minAmount)
  if (result.maxAmount !== undefined) result.maxAmount = String(result.maxAmount)
  if (result.totalUp !== undefined) result.totalUp = String(result.totalUp)
  if (result.totalDown !== undefined) result.totalDown = String(result.totalDown)

  if (result.positions) {
    result.positions = result.positions.map((p: any) => ({
      ...p,
      tgId: String(p.tgId),
      amount: String(p.amount),
    }))
  }

  return result
}

function serializeXProposal(proposal: any) {
  return {
    id: proposal.id,
    uuid: proposal.uuid,
    chainId: proposal.chainId,
    asset: proposal.asset,
    minAmount: proposal.minAmount.toString(),
    maxAmount: proposal.maxAmount.toString(),
    duration: proposal.duration,
    contractAddress: proposal.contractAddress,
    creatorTgId: proposal.creatorXUserId,
    creatorUsername: proposal.creatorUsername || null,
    status: proposal.status,
    tweetId: proposal.tweetId,
    endTime: proposal.endTime ? proposal.endTime.toISOString() : null,
    createdAt: proposal.createdAt ? proposal.createdAt.toISOString() : null,
    totalUp: proposal.totalUp?.toString() || "0",
    totalDown: proposal.totalDown?.toString() || "0",
    source: "x",
    // Event bet fields
    type: proposal.type || "PRICE_BET",
    question: proposal.question || null,
    dataSourceType: proposal.dataSourceType || null,
    dataSourceConfig: proposal.dataSourceConfig ? JSON.parse(proposal.dataSourceConfig) : null,
    outcome: proposal.outcome || null,
    totalYes: proposal.totalYes?.toString() || "0",
    totalNo: proposal.totalNo?.toString() || "0",
  }
}

// ---------- X/Twitter Endpoints ----------

const VALID_PROPOSAL_STATUSES = ["PROPOSED", "OPEN", "LOCKED", "SETTLED", "CANCELLED"] as const
type ProposalStatusLiteral = (typeof VALID_PROPOSAL_STATUSES)[number]

app.get("/api/x/proposals", async (req, res) => {
  try {
    const statusParam = (req.query.status as string | undefined) ?? "OPEN,LOCKED"
    const requested = statusParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is ProposalStatusLiteral =>
        (VALID_PROPOSAL_STATUSES as readonly string[]).includes(s),
      )
    const statuses: ProposalStatusLiteral[] = requested.length ? requested : ["OPEN", "LOCKED"]
    const limit = Math.min(parseInt(String(req.query.limit)) || 50, 100)
    const chainId = req.query.chainId ? parseInt(String(req.query.chainId)) : undefined

    const proposals = await prisma.xProposal.findMany({
      where: {
        status: { in: statuses },
        ...(chainId ? { chainId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    res.json(proposals.map(serializeXProposal))
  } catch (err) {
    console.error("x proposals list error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/x/bet/uuid/:uuid", async (req, res) => {
  try {
    const proposal = await prisma.xProposal.findUnique({ where: { uuid: req.params.uuid } })
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" })
      return
    }

    res.json(serializeXProposal(proposal))
  } catch (err) {
    console.error("x proposal fetch error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.get("/api/x/bet/:id", async (req, res) => {
  try {
    const proposal = await prisma.xProposal.findUnique({ where: { id: Number(req.params.id) } })
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" })
      return
    }

    res.json(serializeXProposal(proposal))
  } catch (err) {
    console.error("x proposal fetch error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/x/register-wallet", async (req, res) => {
  try {
    const { tgId, walletAddress } = req.body as { tgId?: string; walletAddress?: string }
    if (!tgId || !walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      res.status(400).json({ error: "tgId and valid walletAddress required" })
      return
    }

    const xUser = await prisma.xUser.upsert({
      where: { xUserId: String(tgId) },
      update: { walletAddress: walletAddress.toLowerCase() },
      create: { xUserId: String(tgId), walletAddress: walletAddress.toLowerCase() },
    })

    await prisma.xProposal.updateMany({
      where: { creatorXUserId: xUser.xUserId, creatorWallet: null },
      data: { creatorWallet: walletAddress.toLowerCase() },
    })

    res.json({ success: true })
  } catch (err) {
    console.error("x register-wallet error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/x/bet/:id/on-chain-created", async (req, res) => {
  try {
    const proposalId = Number(req.params.id)
    const { contractAddress, onChainBetId, txHash, chainId: bodyChainId } = req.body as {
      contractAddress?: string
      onChainBetId?: string | number
      txHash?: string
      chainId?: number
    }

    if (!contractAddress) {
      res.status(400).json({ error: "contractAddress required" })
      return
    }

    const proposal = await prisma.xProposal.findUnique({ where: { id: proposalId } })
    if (!proposal) {
      res.status(404).json({ error: "Proposal not found" })
      return
    }

    const chainId = bodyChainId ?? proposal.chainId

    await prisma.xProposal.update({
      where: { id: proposalId },
      data: {
        contractAddress,
        onChainBetId: onChainBetId === undefined ? null : Number(onChainBetId),
        txHash: txHash || null,
        chainId,
        status: "OPEN",
      },
    })

    res.json({ success: true })
  } catch (err) {
    console.error("x on-chain-created error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

// ---------- Uniswap Trading API proxy ----------
// All routes forward to https://trade-api.gateway.uniswap.org/v1 with a
// server-side API key and the x-universal-router-version: 2.0 header. Only
// Base mainnet (8453) with USDC as the output, and the whitelisted input
// tokens are allowed. No user signature / auth required.

const BASE_MAINNET_CHAIN_ID = 8453
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase()
const UNISWAP_ALLOWED_INPUT_TOKENS = new Set(
  [
    "0x0000000000000000000000000000000000000000", // native ETH
    "0x4200000000000000000000000000000000000006", // WETH
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
    "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // USDT (Tether-on-Base)
  ].map((a) => a.toLowerCase()),
)

function eqAddr(a: unknown, b: string): boolean {
  return typeof a === "string" && a.toLowerCase() === b.toLowerCase()
}

function isBaseMainnetChainId(v: unknown): boolean {
  return v === BASE_MAINNET_CHAIN_ID || v === String(BASE_MAINNET_CHAIN_ID)
}

app.post("/api/uniswap/quote", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>

    if (!isBaseMainnetChainId(body.tokenInChainId) || !isBaseMainnetChainId(body.tokenOutChainId)) {
      res.status(400).json({ error: "Only Base mainnet (8453) is supported" })
      return
    }
    if (!eqAddr(body.tokenOut, USDC_BASE)) {
      res.status(400).json({ error: "tokenOut must be Base USDC" })
      return
    }
    if (typeof body.tokenIn !== "string" || !UNISWAP_ALLOWED_INPUT_TOKENS.has(body.tokenIn.toLowerCase())) {
      res.status(400).json({ error: "tokenIn not in whitelist" })
      return
    }

    const forwarded: Record<string, unknown> = { ...body }
    if (config.UNISWAP_FEE_BPS > 0 && config.UNISWAP_FEE_RECIPIENT) {
      forwarded.integratorFees = [
        { bips: config.UNISWAP_FEE_BPS, recipient: config.UNISWAP_FEE_RECIPIENT },
      ]
    }

    const result = await uniswapProxy.quote(forwarded)
    res.status(result.status).json(result.body)
  } catch (err) {
    console.error("uniswap /quote error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/uniswap/check_approval", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>

    if (!isBaseMainnetChainId(body.chainId)) {
      res.status(400).json({ error: "Only Base mainnet (8453) is supported" })
      return
    }
    if (typeof body.token !== "string" || !UNISWAP_ALLOWED_INPUT_TOKENS.has(body.token.toLowerCase())) {
      res.status(400).json({ error: "token not in whitelist" })
      return
    }

    const result = await uniswapProxy.checkApproval(body)
    res.status(result.status).json(result.body)
  } catch (err) {
    console.error("uniswap /check_approval error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

app.post("/api/uniswap/swap", async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>
    const inner = (body.quote ?? {}) as Record<string, unknown>

    if (!isBaseMainnetChainId(inner.chainId)) {
      res.status(400).json({ error: "Only Base mainnet (8453) is supported" })
      return
    }

    const result = await uniswapProxy.swap(body)
    res.status(result.status).json(result.body)
  } catch (err) {
    console.error("uniswap /swap error:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})
