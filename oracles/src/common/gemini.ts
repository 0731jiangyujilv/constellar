import { GoogleGenAI } from '@google/genai'
import { config } from './config'
import type { EvidenceItem, Summary, Verdict } from './types'

const MODEL = 'gemini-3-flash-preview'

let cachedClient: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')
  if (cachedClient) return cachedClient
  cachedClient = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY })
  return cachedClient
}

function tryParseJson<T>(text: string, fallback: T): T {
  try {
    const trimmed = text.trim().replace(/^```json\n?/, '').replace(/```$/, '').trim()
    return JSON.parse(trimmed) as T
  } catch {
    return fallback
  }
}

async function generateJson(prompt: string, opts?: { temperature?: number; maxTokens?: number }) {
  const ai = getClient()
  const started = Date.now()
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      temperature: opts?.temperature ?? 0.1,
      maxOutputTokens: opts?.maxTokens ?? 400,
      responseMimeType: 'application/json',
    },
  })
  return { text: res.text ?? '', latencyMs: Date.now() - started }
}

export type GroundedSearchHit = {
  title: string
  uri: string
  snippet: string
}

/**
 * Run a Google Search grounded Gemini query and return the parsed grounding
 * chunks plus the model's narrative. This is what the `google` oracle uses to
 * pull live web evidence — no Custom Search Engine quota required.
 */
export async function geminiGoogleSearch(query: string): Promise<{
  narrative: string
  hits: GroundedSearchHit[]
  latencyMs: number
}> {
  const ai = getClient()
  const started = Date.now()
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
      temperature: 0,
      maxOutputTokens: 800,
    },
  })

  const narrative = res.text ?? ''
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const hits: GroundedSearchHit[] = []
  for (const c of chunks) {
    const w = (c as any).web
    if (w?.uri) {
      hits.push({
        title: String(w.title ?? w.uri),
        uri: String(w.uri),
        snippet: narrative.slice(0, 400),
      })
    }
  }
  return { narrative, hits, latencyMs: Date.now() - started }
}

export type GroundedMapsHit = {
  title: string
  uri: string
  placeId: string
  snippet: string
}

/**
 * Run a Google Maps grounded Gemini query. Returns one hit per place chunk.
 * Optionally accepts a lat/lng pair as additional retrieval context.
 */
export async function geminiGoogleMaps(
  query: string,
  loc?: { latitude: number; longitude: number },
): Promise<{ narrative: string; hits: GroundedMapsHit[]; latencyMs: number }> {
  const ai = getClient()
  const started = Date.now()
  const cfg: Record<string, unknown> = {
    tools: [{ googleMaps: {} }],
    temperature: 0,
    maxOutputTokens: 800,
  }
  if (loc) {
    cfg.toolConfig = {
      retrievalConfig: {
        latLng: { latitude: loc.latitude, longitude: loc.longitude },
      },
    }
  }
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: query,
    config: cfg as any,
  })

  const narrative = res.text ?? ''
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
  const hits: GroundedMapsHit[] = []
  for (const c of chunks) {
    const m = (c as any).maps
    if (m?.uri && m?.placeId) {
      hits.push({
        title: String(m.title ?? 'unknown place'),
        uri: String(m.uri),
        placeId: String(m.placeId),
        snippet: narrative.slice(0, 400),
      })
    }
  }
  return { narrative, hits, latencyMs: Date.now() - started }
}

export async function geminiScoreEvidence(
  question: string,
  raw: { text: string; url: string },
): Promise<{ relevance: number; abstract: string; latencyMs: number }> {
  const prompt = `You are an evidence scorer. Given a question and a raw data snippet, rate how relevant the snippet is to the question (0.0 to 1.0) and extract a concise abstract (max 160 chars).

Question: ${question}

Snippet:
"""
${raw.text.slice(0, 2000)}
"""
Source URL: ${raw.url}

Return ONLY valid JSON: {"relevance": 0.0-1.0, "abstract": "..."}
No markdown, no prose.`

  try {
    const { text, latencyMs } = await generateJson(prompt, { temperature: 0, maxTokens: 200 })
    const parsed = tryParseJson(text, { relevance: 0.5, abstract: raw.text.slice(0, 160) })
    return { ...parsed, latencyMs }
  } catch {
    return { relevance: 0.5, abstract: raw.text.slice(0, 160), latencyMs: 0 }
  }
}

export async function geminiSummarize(
  question: string,
  evidence: EvidenceItem[],
): Promise<Summary & { latencyMs: number }> {
  const evidenceBlock = evidence
    .map((e, i) => `[${i + 1}] (${e.timestamp}) ${e.text}`)
    .join('\n')

  const prompt = `You are a research summarizer for a prediction market oracle. Summarize what the evidence says about the question in ≤ 80 words, preserving specific facts. Estimate how relevant the evidence pool is overall (0.0 to 1.0).

Question: ${question}

Evidence:
${evidenceBlock}

Return ONLY valid JSON: {"summary": "...", "relevance": 0.0-1.0}`

  try {
    const { text, latencyMs } = await generateJson(prompt, { temperature: 0.2, maxTokens: 400 })
    const parsed = tryParseJson(text, { summary: 'no summary available', relevance: 0.4 })
    return { ...parsed, evidenceCount: evidence.length, latencyMs }
  } catch (err: any) {
    return {
      summary: `summarize failed: ${err?.message ?? 'unknown'}`,
      relevance: 0.3,
      evidenceCount: evidence.length,
      latencyMs: 0,
    }
  }
}

export async function geminiVerdict(
  question: string,
  summary: string,
  cites: string[],
): Promise<Verdict & { latencyMs: number }> {
  const prompt = `You are an event resolution judge for a prediction market. Decide YES or NO based on the summary below. Be strict: default to NO unless evidence is clear and direct. Also assign a confidence (0.0 to 1.0) — if confidence < 0.5, return NO.

Question: ${question}

Summary of evidence:
${summary}

Return ONLY valid JSON: {"verdict": "YES"|"NO", "confidence": 0.0-1.0, "reasoning": "brief (≤ 40 words)"}`

  try {
    const { text, latencyMs } = await generateJson(prompt, { temperature: 0, maxTokens: 300 })
    const parsed = tryParseJson<{ verdict: 'YES' | 'NO'; confidence: number; reasoning: string }>(text, {
      verdict: 'NO',
      confidence: 0.3,
      reasoning: 'parse failed, defaulting to NO',
    })

    let verdict: 'YES' | 'NO' = parsed.verdict === 'YES' ? 'YES' : 'NO'
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.3
    if (verdict === 'YES' && confidence < 0.5) verdict = 'NO'

    return {
      verdict,
      confidence,
      reasoning: parsed.reasoning ?? '',
      cites,
      latencyMs,
    }
  } catch (err: any) {
    return {
      verdict: 'NO',
      confidence: 0.1,
      reasoning: `verdict failed: ${err?.message ?? 'unknown'}`,
      cites,
      latencyMs: 0,
    }
  }
}

/**
 * Lightweight intent extractor used by oracles that need to convert a free-form
 * topic into a typed payload (e.g. weather → {location, lat, lng, timeframe}).
 * Returns null on parse failure so callers can fall back to defaults.
 */
export async function geminiExtractIntent<T>(prompt: string): Promise<T | null> {
  try {
    const { text } = await generateJson(prompt, { temperature: 0, maxTokens: 200 })
    const parsed = JSON.parse(text)
    return parsed as T
  } catch {
    return null
  }
}

// ─── search-query distillation ─────────────────────────────────────────────
//
// Bots pass full natural-language questions ("Will the U.S.-Iran ceasefire be
// formally extended again before April 25th, 2026?") as the topic. Direct API
// search engines (X, Reddit, GDELT, YouTube) return zero hits for queries
// like that — they want 3–6 keywords. Even Gemini's grounded search is
// noticeably more reliable when fed the salient entities up front.
//
// One Gemini call per (topic, source) pair, cached for the lifetime of the
// process so cursor=1..N evidence calls don't re-bill the LLM.

const queryCache = new Map<string, string>()

const STOP_WORDS = new Set([
  'will', 'would', 'should', 'shall', 'did', 'does', 'do', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'the', 'a', 'an', 'in', 'on', 'at', 'to',
  'for', 'of', 'with', 'by', 'about', 'before', 'after', 'during', 'until',
  'between', 'against', 'this', 'that', 'these', 'those', 'and', 'or', 'but',
  'if', 'then', 'so', 'than', 'as', 'how', 'what', 'when', 'where', 'who',
  'why', 'which',
])

function fallbackKeywords(topic: string): string {
  const cleaned = topic
    .replace(/[?!.,()"']/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 8)
    .join(' ')
    .trim()
  return cleaned || topic
}

/**
 * Distil a long natural-language question into a short search query suited
 * for `sourceHint` (e.g. "twitter recent posts", "google web search",
 * "news headlines"). Returns 3–6 keywords as a single space-separated string,
 * no operators, no quotes.
 *
 * Falls back to a stop-word-stripped version of the topic if Gemini is
 * unavailable or returns garbage — never returns the verbatim input, so
 * upstream APIs always see something search-friendly.
 */
export async function geminiExtractSearchQuery(
  topic: string,
  sourceHint?: string,
): Promise<string> {
  const cacheKey = `${sourceHint ?? '*'}::${topic}`
  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  if (!config.GEMINI_API_KEY) {
    const fb = fallbackKeywords(topic)
    queryCache.set(cacheKey, fb)
    return fb
  }

  const sourceText = sourceHint ? ` for ${sourceHint}` : ''
  const prompt =
    `You are a search-query optimiser. Convert the question below into a concise search query${sourceText}.\n` +
    `Rules:\n` +
    `  - 3 to 6 keywords, single space-separated string\n` +
    `  - keep proper nouns, named entities, key events\n` +
    `  - drop question words (will/did/does/should), articles, dates\n` +
    `  - no quotes, no boolean operators, no hashtags\n` +
    `Question: ${topic}\n\n` +
    `Return ONLY the keyword string, nothing else.`

  try {
    const ai = getClient()
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { temperature: 0, maxOutputTokens: 60 },
    })
    const raw = (res.text ?? '').trim()
    const cleaned = raw
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/^keywords?\s*[:\-]\s*/i, '')
      .replace(/\n.*$/s, '')
      .trim()
    if (cleaned && cleaned.length < 200 && cleaned.split(/\s+/).length >= 2) {
      queryCache.set(cacheKey, cleaned)
      return cleaned
    }
  } catch (err: any) {
    console.warn(`[gemini] keyword extraction failed: ${err?.message ?? err}`)
  }

  const fb = fallbackKeywords(topic)
  queryCache.set(cacheKey, fb)
  return fb
}
