import { config } from './config'
import type { EvidenceItem, Summary, Verdict } from './types'

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.GEMINI_API_KEY}`

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

async function callGemini(prompt: string, opts?: { temperature?: number; maxTokens?: number }) {
  if (!config.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured')
  const started = Date.now()
  const res = await fetch(GEMINI_URL('gemini-2.0-flash'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts?.temperature ?? 0.1,
        maxOutputTokens: opts?.maxTokens ?? 400,
        responseMimeType: 'application/json',
      },
    }),
  })
  if (!res.ok) throw new Error(`gemini http ${res.status}: ${await res.text()}`)
  const json = (await res.json()) as GeminiResponse
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return { text, latencyMs: Date.now() - started }
}

function tryParseJson<T>(text: string, fallback: T): T {
  try {
    const trimmed = text.trim().replace(/^```json\n?/, '').replace(/```$/, '').trim()
    return JSON.parse(trimmed) as T
  } catch {
    return fallback
  }
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
    const { text, latencyMs } = await callGemini(prompt, { temperature: 0, maxTokens: 200 })
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
    const { text, latencyMs } = await callGemini(prompt, { temperature: 0.2, maxTokens: 400 })
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
    const { text, latencyMs } = await callGemini(prompt, { temperature: 0, maxTokens: 300 })
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
