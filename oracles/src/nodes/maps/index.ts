import { PERSONAS } from '@/common/config'
import { geminiExtractSearchQuery, geminiGoogleMaps } from '@/common/gemini'
import { createOracleApp } from '@/common/oracle-app'
import type { EvidenceItem } from '@/common/types'

/**
 * Maps oracle — Gemini's `googleMaps` grounding tool. Each chunk in the
 * response's groundingMetadata becomes one EvidenceItem (placeId + URI +
 * title + a short slice of the model narrative for context).
 *
 * The raw bot question is rephrased into a place-centric query first; the
 * grounding tool only fires reliably when the prompt asks about places.
 */
async function fetchFromMaps(topic: string): Promise<EvidenceItem[]> {
  try {
    const keywords = await geminiExtractSearchQuery(topic, 'google maps places lookup')
    const prompt = `Find places relevant to: ${keywords}. Return notable locations with addresses.`
    const { hits } = await geminiGoogleMaps(prompt)
    return hits.map((h, i): EvidenceItem => ({
      id: `maps-${Date.now()}-${i}`,
      text: `${h.title} — ${h.snippet}`,
      url: h.uri,
      author: h.placeId,
      timestamp: new Date().toISOString(),
      source: 'maps',
    }))
  } catch (err: any) {
    console.warn(`[maps] grounded search failed: ${err?.message ?? err}`)
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.maps, async ({ topic }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromMaps(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  return item ? { ...item, cursor: String(state.idx) } : null
})
