import { PERSONAS, config } from '@/common/config'
import { geminiExtractIntent } from '@/common/gemini'
import { createOracleApp } from '@/common/oracle-app'
import type { EvidenceItem } from '@/common/types'

/**
 * Weather oracle — Google Weather API (Maps Platform) driven by Gemini for
 * intent parsing. Gemini reads the raw topic and returns { location, lat, lng,
 * timeframe }, then we call the appropriate Weather endpoint.
 *
 * Docs:
 *   - Weather overview:   https://developers.google.com/maps/documentation/weather/overview
 *   - Current conditions: v1.currentConditions:lookup
 *   - Daily forecast:     v1.forecast.days:lookup (up to 10 days)
 */

type IntentSchema = {
  location: string
  latitude: number
  longitude: number
  timeframe: 'current' | 'daily' | 'hourly'
  days?: number
}

async function extractIntent(topic: string): Promise<IntentSchema | null> {
  const prompt =
    `Extract weather query intent from the topic. Return JSON with: location (human name), ` +
    `latitude, longitude (numeric, best estimate if unnamed), timeframe ("current" | "daily" | "hourly"), ` +
    `days (1-10 only if timeframe=daily, else 0). If no location, default to New York, NY.\n` +
    `Topic: "${topic}"`
  const parsed = await geminiExtractIntent<IntentSchema>(prompt)
  if (
    !parsed ||
    typeof parsed.latitude !== 'number' ||
    typeof parsed.longitude !== 'number' ||
    !parsed.timeframe
  ) {
    return null
  }
  return parsed
}

type CurrentConditionsResp = {
  currentTime?: string
  weatherCondition?: { description?: { text?: string }; type?: string }
  temperature?: { degrees?: number; unit?: string }
  feelsLikeTemperature?: { degrees?: number; unit?: string }
  relativeHumidity?: number
  precipitation?: { probability?: { percent?: number; type?: string } }
  wind?: { speed?: { value?: number; unit?: string } }
}

async function fetchCurrentConditions(intent: IntentSchema): Promise<EvidenceItem[]> {
  if (!config.GOOGLE_MAPS_API_KEY) return []
  const endpoint = new URL('https://weather.googleapis.com/v1/currentConditions:lookup')
  endpoint.searchParams.set('key', config.GOOGLE_MAPS_API_KEY)
  endpoint.searchParams.set('location.latitude', String(intent.latitude))
  endpoint.searchParams.set('location.longitude', String(intent.longitude))
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const j = (await res.json()) as CurrentConditionsResp
    const parts = [
      j.weatherCondition?.description?.text ?? j.weatherCondition?.type ?? '',
      j.temperature ? `temp ${j.temperature.degrees}°${j.temperature.unit ?? 'C'}` : '',
      j.feelsLikeTemperature
        ? `feels ${j.feelsLikeTemperature.degrees}°${j.feelsLikeTemperature.unit ?? 'C'}`
        : '',
      j.relativeHumidity != null ? `humidity ${j.relativeHumidity}%` : '',
      j.precipitation?.probability?.percent != null
        ? `precip ${j.precipitation.probability.percent}%`
        : '',
      j.wind?.speed?.value != null
        ? `wind ${j.wind.speed.value} ${j.wind.speed.unit ?? 'km/h'}`
        : '',
    ].filter(Boolean)
    return [
      {
        id: `wx-${Date.now()}`,
        text: `${intent.location}: ${parts.join(' · ')}`,
        url: `https://www.google.com/maps/@${intent.latitude},${intent.longitude},13z`,
        author: 'Google Weather',
        timestamp: j.currentTime ?? new Date().toISOString(),
        source: 'weather',
      },
    ]
  } catch {
    return []
  }
}

type DailyForecastResp = {
  forecastDays?: {
    displayDate?: { year?: number; month?: number; day?: number }
    daytimeForecast?: {
      weatherCondition?: { description?: { text?: string } }
      precipitation?: { probability?: { percent?: number } }
    }
    maxTemperature?: { degrees?: number; unit?: string }
    minTemperature?: { degrees?: number; unit?: string }
  }[]
}

async function fetchDailyForecast(intent: IntentSchema): Promise<EvidenceItem[]> {
  if (!config.GOOGLE_MAPS_API_KEY) return []
  const endpoint = new URL('https://weather.googleapis.com/v1/forecast/days:lookup')
  endpoint.searchParams.set('key', config.GOOGLE_MAPS_API_KEY)
  endpoint.searchParams.set('location.latitude', String(intent.latitude))
  endpoint.searchParams.set('location.longitude', String(intent.longitude))
  endpoint.searchParams.set('days', String(Math.min(10, Math.max(1, intent.days ?? 3))))
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return []
    const j = (await res.json()) as DailyForecastResp
    return (j.forecastDays ?? []).map((d, i): EvidenceItem => {
      const date = d.displayDate
        ? `${d.displayDate.year}-${String(d.displayDate.month).padStart(2, '0')}-${String(d.displayDate.day).padStart(2, '0')}`
        : `day${i}`
      const cond = d.daytimeForecast?.weatherCondition?.description?.text ?? 'n/a'
      const pop = d.daytimeForecast?.precipitation?.probability?.percent
      const hi = d.maxTemperature?.degrees
      const lo = d.minTemperature?.degrees
      const unit = d.maxTemperature?.unit ?? 'C'
      return {
        id: `wx-d-${Date.now()}-${i}`,
        text: `${intent.location} ${date}: ${cond} · hi ${hi}°${unit} / lo ${lo}°${unit}${
          pop != null ? ` · precip ${pop}%` : ''
        }`,
        url: `https://www.google.com/maps/@${intent.latitude},${intent.longitude},13z`,
        author: 'Google Weather',
        timestamp: new Date().toISOString(),
        source: 'weather',
      }
    })
  } catch {
    return []
  }
}

const cache = new Map<string, { items: EvidenceItem[]; idx: number }>()

createOracleApp(PERSONAS.weather, async ({ topic }) => {
  const key = topic.toLowerCase()
  let state = cache.get(key)
  if (!state || state.idx >= state.items.length) {
    const intent = await extractIntent(topic)
    let live: EvidenceItem[] = []
    if (intent) {
      live = intent.timeframe === 'daily'
        ? await fetchDailyForecast(intent)
        : await fetchCurrentConditions(intent)
    }
    state = { items: live, idx: 0 }
    cache.set(key, state)
  }
  const item = state.items[state.idx]
  state.idx += 1
  return item ? { ...item, cursor: String(state.idx) } : null
})
