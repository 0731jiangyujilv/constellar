import { randomBytes } from 'node:crypto'
import type { DataSource, EvidenceItem } from './types'

const STUB_AUTHORS: Record<DataSource, string[]> = {
  twitter: ['@arthur_hayes', '@coinbase', '@elonmusk', '@whale_alert', '@CryptoHayes'],
  google: ['coindesk.com', 'reuters.com', 'bloomberg.com', 'theblock.co', 'ft.com'],
  news: ['Reuters', 'Associated Press', 'BBC', 'Bloomberg', 'Al Jazeera'],
  reddit: ['u/cryptobull', 'u/defi_dan', 'u/macrotrader', 'u/onchain_nerd', 'u/polymarketguy'],
  youtube: ['@BloombergTV', '@CNBC', '@BenjaminCowen', '@RealVision', '@Unchained'],
}

const STUB_SNIPPETS = [
  'Early indicators suggest the event is unlikely given current conditions.',
  'Multiple sources report conflicting signals with no clear direction yet.',
  'Analysts cite weak momentum and macro headwinds as key concerns.',
  'A surprise announcement could shift sentiment sharply in either direction.',
  'On-chain flow has been muted throughout the week.',
  'Futures positioning leans cautious heading into the resolution window.',
  'Recent commentary from policy makers has been neutral to dovish.',
  'Social volume spiked 3x but sentiment is split roughly 60/40.',
]

export function makeStubEvidence(topic: string, source: DataSource, cursor?: string): EvidenceItem {
  const authors = STUB_AUTHORS[source]
  const author = authors[Math.floor(Math.random() * authors.length)]
  const snippet = STUB_SNIPPETS[Math.floor(Math.random() * STUB_SNIPPETS.length)]
  const id = `${source}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
  const nextCursor = `${Number(cursor ?? 0) + 1}`
  const urlBase: Record<DataSource, string> = {
    twitter: `https://x.com/i/web/status/${randomBytes(8).toString('hex')}`,
    google: `https://example.com/article/${randomBytes(6).toString('hex')}`,
    news: `https://news.example.com/${randomBytes(6).toString('hex')}`,
    reddit: `https://reddit.com/r/cryptocurrency/comments/${randomBytes(4).toString('hex')}`,
    youtube: `https://youtube.com/watch?v=${randomBytes(6).toString('hex')}`,
  }
  return {
    id,
    text: `[${topic}] ${snippet} (${author})`,
    url: urlBase[source],
    author,
    timestamp: new Date().toISOString(),
    source,
    cursor: nextCursor,
  }
}
