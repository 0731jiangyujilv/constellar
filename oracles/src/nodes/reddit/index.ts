import { PERSONAS, config } from '@/common/config'
import { createOracleApp } from '@/common/oracle-app'
import { makeStubEvidence } from '@/common/stub'
import type { EvidenceItem } from '@/common/types'

async function fetchFromReddit(topic: string): Promise<EvidenceItem[]> {
  try {
    const url = new URL('https://www.reddit.com/search.json')
    url.searchParams.set('q', topic)
    url.searchParams.set('sort', 'new')
    url.searchParams.set('limit', '10')
    url.searchParams.set('t', 'day')

    const res = await fetch(url, {
      headers: { 'User-Agent': config.REDDIT_USER_AGENT },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { children?: { data: { id: string; title: string; selftext: string; permalink: string; author: string; created_utc: number } }[] }
    }
    return (json.data?.children ?? []).map(({ data: d }) => ({
      id: `rd-${d.id}`,
      text: `${d.title}${d.selftext ? ' — ' + d.selftext.slice(0, 300) : ''}`,
      url: `https://reddit.com${d.permalink}`,
      author: `u/${d.author}`,
      timestamp: new Date(d.created_utc * 1000).toISOString(),
      source: 'reddit',
    }))
  } catch {
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.reddit, async ({ topic, cursor }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromReddit(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  if (item) return { ...item, cursor: String(state.idx) }
  return makeStubEvidence(topic, 'reddit', cursor)
})
