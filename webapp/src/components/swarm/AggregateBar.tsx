import { useEffect, useRef, useState } from 'react'
import type { SwarmAggregate } from '@/types/swarm'

type Props = {
  aggregate: SwarmAggregate
  pulseTick: { nodeId: string; at: number } | null
  nodeOrder: string[]
}

type Blip = { id: string; x: number; at: number }

export function AggregateBar({ aggregate, pulseTick, nodeOrder }: Props) {
  const [blips, setBlips] = useState<Blip[]>([])
  const lastTick = useRef<number>(0)

  useEffect(() => {
    if (!pulseTick) return
    if (pulseTick.at === lastTick.current) return
    lastTick.current = pulseTick.at
    const idx = nodeOrder.indexOf(pulseTick.nodeId)
    if (idx < 0) return
    const x = ((idx + 0.5) / nodeOrder.length) * 100
    const blip: Blip = { id: `${pulseTick.at}-${pulseTick.nodeId}`, x, at: pulseTick.at }
    setBlips((curr) => [...curr.slice(-20), blip])
    const timer = setTimeout(() => {
      setBlips((curr) => curr.filter((b) => b.id !== blip.id))
    }, 1800)
    return () => clearTimeout(timer)
  }, [pulseTick, nodeOrder])

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-[0_2px_12px_-4px_rgba(0,82,255,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10F3B5] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10F3B5]" />
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-[0.22em] text-slate-900">
              ORACLE SWARM · LIVE
            </span>
          </div>
          <span className="hidden h-4 w-px bg-slate-200 md:block" />
          <div className="font-mono text-[10px] tracking-[0.14em] text-slate-500">
            CHAIN <span className="text-[#0052ff]">ARC</span> · BLOCK{' '}
            <span className="tabular-nums text-slate-700">{aggregate.arcBlock.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <Stat label="ONLINE" value={`${aggregate.onlineCount}/${aggregate.totalCount}`} accent={aggregate.onlineCount === aggregate.totalCount ? '#10F3B5' : '#FFC44D'} />
          <Stat label="QUERIES · 1H" value={aggregate.queries1h.toLocaleString()} />
          <Stat label="EVIDENCE · 24H" value={aggregate.evidenceServed24h.toLocaleString()} />
          <Stat label="NANOPAYS" value={aggregate.totalNanoPayments.toLocaleString()} accent="#0052ff" />
          <Stat label="EARNED · 24H" value={`$${aggregate.totalEarnings24hUsdc.toFixed(4)}`} accent="#10F3B5" />
        </div>
      </div>

      {/* Pulse lane */}
      <div className="relative mt-5 h-6 overflow-hidden rounded-md bg-slate-50 ring-1 ring-slate-200">
        {/* tick marks for each node */}
        {nodeOrder.map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-px bg-slate-200"
            style={{ left: `${((i + 0.5) / nodeOrder.length) * 100}%` }}
          />
        ))}
        {/* scrolling gridlines (ECG feel) */}
        <div className="pointer-events-none absolute inset-0 opacity-60 bg-[linear-gradient(90deg,transparent_0,transparent_calc(100%/24),rgba(20,20,20,0.06)_calc(100%/24),rgba(20,20,20,0.06)_calc(100%/24+1px),transparent_calc(100%/24+1px))] bg-[length:calc(100%/24)_100%]" />
        {/* center baseline */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-300" />
        {/* blips */}
        {blips.map((b) => (
          <div
            key={b.id}
            className="absolute top-0 bottom-0 flex items-center justify-center animate-[blip-fade_1.8s_ease-out_forwards]"
            style={{ left: `calc(${b.x}% - 14px)`, width: 28 }}
          >
            <svg viewBox="0 0 40 24" className="h-full w-full">
              <path
                d="M0 12 L10 12 L13 4 L17 20 L21 2 L25 18 L28 12 L40 12"
                fill="none"
                stroke="#10F3B5"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, accent = '#0F172A' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] tracking-[0.18em] text-slate-400">{label}</span>
      <span className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums" style={{ color: accent }}>
        {value}
      </span>
    </div>
  )
}
