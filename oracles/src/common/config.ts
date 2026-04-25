import 'dotenv/config'
import { z } from 'zod'
import type { OraclePersona } from './types'

const schema = z.object({
  BOT_HEARTBEAT_URL: z.string().default('http://localhost:3000/api/swarm/heartbeat'),
  GEMINI_API_KEY: z.string().default(''),

  // Circle Gateway facilitator URL — testnet default; buyers and sellers MUST
  // agree. Arc testnet is the only supported network in this deployment.
  X402_FACILITATOR_URL: z.string().default('https://gateway-api-testnet.circle.com'),

  PORT_TWITTER: z.coerce.number().default(4001),
  PORT_GOOGLE: z.coerce.number().default(4002),
  PORT_NEWS: z.coerce.number().default(4003),
  PORT_REDDIT: z.coerce.number().default(4004),
  PORT_YOUTUBE: z.coerce.number().default(4005),
  PORT_MAPS: z.coerce.number().default(4006),
  PORT_WEATHER: z.coerce.number().default(4007),

  X_BEARER_TOKEN: z.string().default(''),
  GOOGLE_CSE_KEY: z.string().default(''),
  GOOGLE_CSE_CX: z.string().default(''),
  GDELT_API_URL: z.string().default('https://api.gdeltproject.org/api/v2/doc/doc'),
  REDDIT_USER_AGENT: z.string().default('betsys-oracle/0.1'),
  YOUTUBE_API_KEY: z.string().default(''),
  // Google Maps Platform API key. Used by both the maps oracle (via Gemini
  // `googleMaps` grounding tool) and the weather oracle (Google Weather API,
  // which lives under Maps Platform). Same key works for both.
  GOOGLE_MAPS_API_KEY: z.string().default(''),

  WALLET_TWITTER: z.string().default('0x4a2c8b9f7e3d1a5c2b0f8e7d6a9c4b2f8f2c0000'),
  WALLET_GOOGLE: z.string().default('0x9131ab73ef21d9c4f8b2a7e6d8c3f1a937ed0000'),
  WALLET_NEWS: z.string().default('0x7dab42ef8c0a15b9d6e4f3c281bfa92c10400000'),
  WALLET_REDDIT: z.string().default('0x5c92f1e84bd30a7c9f2e5b8d4a1c6f8e92730000'),
  WALLET_YOUTUBE: z.string().default('0x3f08ac62d9b1e7f5c8a4b3d2f1e6c9a83a1b0000'),
  WALLET_MAPS: z.string().default('0x2c6dfa18b5c9e41f7b3a2e8d6f4c1b9a3d7e0000'),
  WALLET_WEATHER: z.string().default('0x8e5f2a7bd9c3e14f0a6b8c7d5e2f9b4a1c380000'),

  // ERC-8004 OracleRegistry (Arc testnet) — used by registry-reader for
  // reputation reads via viem. Not involved in payment settlement anymore.
  ORACLE_REGISTRY_ADDRESS: z.string().default(''),
  ARC_RPC_URL: z.string().default('https://arc-testnet.drpc.org'),
  ARC_CHAIN_ID: z.coerce.number().default(5042002),

  AGENT_TOKEN_TWITTER: z.coerce.number().default(0),
  AGENT_TOKEN_GOOGLE:  z.coerce.number().default(0),
  AGENT_TOKEN_NEWS:    z.coerce.number().default(0),
  AGENT_TOKEN_REDDIT:  z.coerce.number().default(0),
  AGENT_TOKEN_YOUTUBE: z.coerce.number().default(0),
  AGENT_TOKEN_MAPS:    z.coerce.number().default(0),
  AGENT_TOKEN_WEATHER: z.coerce.number().default(0),
})

export const config = schema.parse(process.env)

export const PERSONAS: Record<string, OraclePersona> = {
  twitter: {
    id: 'oracle-twitter-01',
    name: 'Twitter Scout',
    emoji: '🐦',
    dataSource: 'twitter',
    tagline: 'real-time social signal from X',
    walletAddress: config.WALLET_TWITTER as `0x${string}`,
    port: config.PORT_TWITTER,
    heartbeatIntervalMs: 5000,
    agentTokenId: config.AGENT_TOKEN_TWITTER,
  },
  google: {
    id: 'oracle-google-02',
    name: 'Google Indexer',
    emoji: '🔎',
    dataSource: 'google',
    tagline: 'web search via Custom Search API',
    walletAddress: config.WALLET_GOOGLE as `0x${string}`,
    port: config.PORT_GOOGLE,
    heartbeatIntervalMs: 7000,
    agentTokenId: config.AGENT_TOKEN_GOOGLE,
  },
  news: {
    id: 'oracle-news-03',
    name: 'GDELT Sentinel',
    emoji: '📰',
    dataSource: 'news',
    tagline: 'global news via GDELT 2.0 Doc API',
    walletAddress: config.WALLET_NEWS as `0x${string}`,
    port: config.PORT_NEWS,
    heartbeatIntervalMs: 8000,
    agentTokenId: config.AGENT_TOKEN_NEWS,
  },
  reddit: {
    id: 'oracle-reddit-04',
    name: 'Reddit Watcher',
    emoji: '👽',
    dataSource: 'reddit',
    tagline: 'UGC discourse from subreddit feeds',
    walletAddress: config.WALLET_REDDIT as `0x${string}`,
    port: config.PORT_REDDIT,
    heartbeatIntervalMs: 6000,
    agentTokenId: config.AGENT_TOKEN_REDDIT,
  },
  youtube: {
    id: 'oracle-youtube-05',
    name: 'YouTube Probe',
    emoji: '📺',
    dataSource: 'youtube',
    tagline: 'video metadata + captions via YT Data API',
    walletAddress: config.WALLET_YOUTUBE as `0x${string}`,
    port: config.PORT_YOUTUBE,
    heartbeatIntervalMs: 9000,
    agentTokenId: config.AGENT_TOKEN_YOUTUBE,
  },
  maps: {
    id: 'oracle-maps-06',
    name: 'Maps Navigator',
    emoji: '🗺️',
    dataSource: 'maps',
    tagline: 'places via Gemini × Google Maps grounding',
    walletAddress: config.WALLET_MAPS as `0x${string}`,
    port: config.PORT_MAPS,
    heartbeatIntervalMs: 7500,
    agentTokenId: config.AGENT_TOKEN_MAPS,
  },
  weather: {
    id: 'oracle-weather-07',
    name: 'Weather Sentinel',
    emoji: '🌤️',
    dataSource: 'weather',
    tagline: 'conditions + forecasts via Google Weather API',
    walletAddress: config.WALLET_WEATHER as `0x${string}`,
    port: config.PORT_WEATHER,
    heartbeatIntervalMs: 6500,
    agentTokenId: config.AGENT_TOKEN_WEATHER,
  },
}

export const PRICE_USDC_MICRO = {
  evidence: 1000n,
  summarize: 3000n,
  verdict: 5000n,
} as const

export const VERSION = '0.1.0'
