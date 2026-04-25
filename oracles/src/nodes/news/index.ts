import { PERSONAS, config } from '@/common/config'
import { geminiExtractSearchQuery } from '@/common/gemini'
import { createOracleApp } from '@/common/oracle-app'
import type { EvidenceItem } from '@/common/types'

async function fetchFromGdelt(topic: string): Promise<EvidenceItem[]> {
  try {
    const keywords = await geminiExtractSearchQuery(topic, 'news headlines')
    const url = new URL(config.GDELT_API_URL)
    url.searchParams.set('query', `${keywords} sourcelang:english`)
    url.searchParams.set('mode', 'artlist')
    url.searchParams.set('format', 'json')
    url.searchParams.set('maxrecords', '10')
    url.searchParams.set('timespan', '1d')

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const json = (await res.json()) as {
      articles?: { title: string; url: string; seendate: string; domain: string }[]
    }
    return (json.articles ?? []).map((a, i) => ({
      id: `gdelt-${Date.now()}-${i}`,
      text: a.title,
      url: a.url,
      author: a.domain,
      timestamp: a.seendate ? a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
      source: 'news',
    }))
  } catch {
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.news, async ({ topic }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromGdelt(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  return item ? { ...item, cursor: String(state.idx) } : null
})
