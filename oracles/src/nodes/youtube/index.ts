import { PERSONAS, config } from '@/common/config'
import { createOracleApp } from '@/common/oracle-app'
import { makeStubEvidence } from '@/common/stub'
import type { EvidenceItem } from '@/common/types'

async function fetchFromYoutube(topic: string): Promise<EvidenceItem[]> {
  if (!config.YOUTUBE_API_KEY) return []
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('key', config.YOUTUBE_API_KEY)
    url.searchParams.set('q', topic)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('type', 'video')
    url.searchParams.set('order', 'date')
    url.searchParams.set('maxResults', '10')

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const json = (await res.json()) as {
      items?: { id: { videoId: string }; snippet: { title: string; description: string; channelTitle: string; publishedAt: string } }[]
    }
    return (json.items ?? []).map((v) => ({
      id: `yt-${v.id.videoId}`,
      text: `${v.snippet.title} — ${v.snippet.description}`,
      url: `https://youtube.com/watch?v=${v.id.videoId}`,
      author: v.snippet.channelTitle,
      timestamp: v.snippet.publishedAt,
      source: 'youtube',
    }))
  } catch {
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.youtube, async ({ topic, cursor }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const live = await fetchFromYoutube(topic)
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  if (item) return { ...item, cursor: String(state.idx) }
  return makeStubEvidence(topic, 'youtube', cursor)
})
