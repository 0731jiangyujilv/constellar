import { PERSONAS, config } from '@/common/config'
import { createOracleApp } from '@/common/oracle-app'
import { makeStubEvidence } from '@/common/stub'
import type { EvidenceItem } from '@/common/types'

async function fetchFromGoogle(topic: string): Promise<EvidenceItem[]> {
  if (!config.GOOGLE_CSE_KEY || !config.GOOGLE_CSE_CX) return []
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', config.GOOGLE_CSE_KEY)
    url.searchParams.set('cx', config.GOOGLE_CSE_CX)
    url.searchParams.set('q', topic)
    url.searchParams.set('num', '10')
    url.searchParams.set('dateRestrict', 'd1')

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const json = (await res.json()) as { items?: { title: string; snippet: string; link: string; displayLink: string }[] }
    return (json.items ?? []).map((it, i) => ({
      id: `g-${Date.now()}-${i}`,
      text: `${it.title} — ${it.snippet}`,
      url: it.link,
      author: it.displayLink,
      timestamp: new Date().toISOString(),
      source: 'google',
    }))
  } catch {
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.google, async ({ topic, cursor }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromGoogle(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  if (item) return { ...item, cursor: String(state.idx) }
  return makeStubEvidence(topic, 'google', cursor)
})
