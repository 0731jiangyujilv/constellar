import { PERSONAS } from '@/common/config'
import { geminiExtractSearchQuery, geminiGoogleSearch } from '@/common/gemini'
import { createOracleApp } from '@/common/oracle-app'
import type { EvidenceItem } from '@/common/types'

/**
 * Google oracle — uses Gemini's native `googleSearch` grounding tool to fetch
 * live web hits for a topic. Each grounding chunk becomes one evidence item.
 *
 * The bot passes the full natural-language question as `topic`; we run it
 * through `geminiExtractSearchQuery` first to distil 3–6 keywords, otherwise
 * Gemini frequently chooses not to ground long Q&A-style prompts and we get
 * an empty groundingMetadata.
 */
async function fetchFromGoogle(topic: string): Promise<EvidenceItem[]> {
  try {
    const keywords = await geminiExtractSearchQuery(topic, 'google web search')
    const prompt = `Search the web for the latest reliable information on: ${keywords}. Cite sources.`
    const { hits } = await geminiGoogleSearch(prompt)
    return hits.map((h, i) => ({
      id: `g-${Date.now()}-${i}`,
      text: `${h.title} — ${h.snippet}`,
      url: h.uri,
      author: safeHost(h.uri),
      timestamp: new Date().toISOString(),
      source: 'google',
    }))
  } catch (err: any) {
    console.warn(`[google] grounded search failed: ${err?.message ?? err}`)
    return []
  }
}

function safeHost(uri: string): string {
  try {
    return new URL(uri).host
  } catch {
    return 'web'
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.google, async ({ topic }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromGoogle(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  return item ? { ...item, cursor: String(state.idx) } : null
})
