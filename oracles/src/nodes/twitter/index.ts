import { PERSONAS, config } from '@/common/config'
import { geminiExtractSearchQuery } from '@/common/gemini'
import { createOracleApp } from '@/common/oracle-app'
import type { EvidenceItem } from '@/common/types'

async function fetchFromX(topic: string): Promise<EvidenceItem[]> {
  if (!config.X_BEARER_TOKEN) return []
  try {
    const keywords = await geminiExtractSearchQuery(topic, 'twitter recent posts')
    const url = new URL('https://api.x.com/2/tweets/search/recent')
    url.searchParams.set('query', `${keywords} -is:retweet lang:en`)
    url.searchParams.set('max_results', '10')
    url.searchParams.set('tweet.fields', 'created_at,author_id')

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.X_BEARER_TOKEN}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: { id: string; text: string; created_at: string; author_id: string }[] }
    return (json.data ?? []).map((t) => ({
      id: `tw-${t.id}`,
      text: t.text,
      url: `https://x.com/i/web/status/${t.id}`,
      author: t.author_id,
      timestamp: t.created_at,
      source: 'twitter',
    }))
  } catch {
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.twitter, async ({ topic }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromX(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  return item ? { ...item, cursor: String(state.idx) } : null
})
