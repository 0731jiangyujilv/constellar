import { useEffect, useState } from 'react'
import type { OracleNode } from '@/types/swarm'
import { arcAddressLink, arcContractReadLink } from '@/lib/explorer'
import { Sparkline } from './Sparkline'

type Props = {
  node: OracleNode
  pulse: boolean
  killed: boolean
  onToggleKill: () => void
}

const STATUS_META: Record<OracleNode['status'], { label: string; dot: string; ring: string; text: string }> = {
  healthy: {
    label: 'LIVE',
    dot: 'bg-[#10F3B5]',
    ring: 'ring-[#10F3B5]/30 border-[#10F3B5]/25 shadow-[0_0_16px_-6px_rgba(16,243,181,0.20)]',
    text: 'text-[#10F3B5]',
  },
  degraded: {
    label: 'SLOW',
    dot: 'bg-[#FFC44D]',
    ring: 'ring-[#FFC44D]/30 border-[#FFC44D]/25 shadow-[0_0_16px_-6px_rgba(255,196,77,0.20)]',
    text: 'text-[#FFC44D]',
  },
  offline: {
    label: 'OFFLINE',
    dot: 'bg-[#FF3B5C]',
    ring: 'ring-[#FF3B5C]/30 border-[#FF3B5C]/30 shadow-[0_0_16px_-6px_rgba(255,59,92,0.20)]',
    text: 'text-[#FF3B5C]',
  },
}

function fmtUptime(sec: number): string {
  if (sec < 60) return `${Math.floor(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function fmtAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function HeartbeatAgo({ ts }: { ts: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, (now - ts) / 1000)
  return <span className="tabular-nums">{diff.toFixed(1)}s</span>
}

function AccuracyBar({ value, offline }: { value: number; offline: boolean }) {
  const cells = 12
  const filled = Math.round(value * cells)
  return (
    <div style={{display: 'none'}} className="flex items-center gap-2">
      <span className="font-mono text-[10px] tracking-[0.12em] text-slate-400">ACCURACY</span>
      <div className="flex gap-[2px] font-mono text-[11px] leading-none">
        {Array.from({ length: cells }).map((_, i) => {
          const on = i < filled
          const color = offline
            ? 'text-slate-300'
            : on
              ? value > 0.85
                ? 'text-[#10F3B5]'
                : value > 0.7
                  ? 'text-[#FFC44D]'
                  : 'text-[#FF3B5C]'
              : 'text-slate-200'
          return (
            <span key={i} className={color}>
              █
            </span>
          )
        })}
      </div>
      <span className={`font-mono text-[11px] tabular-nums ${offline ? 'text-slate-400' : 'text-slate-700'}`}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

export function OracleCard({ node, pulse, killed, onToggleKill }: Props) {
  const [pulseKey, setPulseKey] = useState(0)
  useEffect(() => {
    if (pulse) setPulseKey((k) => k + 1)
  }, [pulse])

  const status = STATUS_META[node.status]
  const offline = node.status === 'offline'
  const accent = node.status === 'healthy' ? '#10F3B5' : node.status === 'degraded' ? '#FFC44D' : '#FF3B5C'

  return (
    <div
      className={`relative rounded-2xl border bg-white p-5 ring-1 transition-all ${status.ring} ${
        offline ? 'animate-[offline-breath_2.4s_ease-in-out_infinite]' : ''
      }`}
    >
      {/* Pulse ring on heartbeat */}
      {pulse && !offline && (
        <span
          key={pulseKey}
          className="pointer-events-none absolute -inset-px rounded-2xl ring-2 ring-[#10F3B5]/60 animate-[card-pulse_1.1s_ease-out]"
        />
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-2xl ring-1 ring-slate-200">
              <span style={{ filter: offline ? 'grayscale(1) opacity(0.4)' : 'none' }}>{node.emoji}</span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-semibold tracking-[0.18em] text-slate-900">
                {node.name.toUpperCase()}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-500">{node.id}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${status.dot} ${offline ? '' : 'animate-pulse'}`} />
            <span className={`font-mono text-[10px] tracking-[0.2em] ${status.text}`}>● {status.label}</span>
          </div>
        </div>

        <div className="mt-1.5 font-mono text-[10.5px] tracking-wide text-slate-500">{node.tagline}</div>

        {/* ERC-8004 identity + reputation badge */}
        {(node.agentTokenId || typeof node.reputation === 'number') && (
          <div className="mt-2.5 flex items-center gap-2 font-mono text-[9px] tracking-[0.18em]">
            {(() => {
              const registryLink = arcContractReadLink(node.registryAddress) ?? arcAddressLink(node.registryAddress)
              const LabelTag = registryLink ? 'a' : 'span'
              return (
                <LabelTag
                  {...(registryLink
                    ? { href: registryLink, target: '_blank', rel: 'noopener noreferrer', title: 'OracleRegistry on Arc' }
                    : {})}
                  className={`rounded-sm border border-[#0052ff]/25 bg-[#0052ff]/5 px-1.5 py-0.5 text-[#0052ff] ${
                    registryLink ? 'transition hover:border-[#0052ff]/60 hover:bg-[#0052ff]/20' : ''
                  }`}
                >
                  ERC-8004
                </LabelTag>
              )
            })()}
            {node.agentTokenId ? (
              (() => {
                const readLink = arcContractReadLink(node.registryAddress)
                const inner = (
                  <>
                    ID <span className="tabular-nums text-slate-700">#{node.agentTokenId}</span>
                  </>
                )
                return readLink ? (
                  <a
                    href={readLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`read agents(${node.agentTokenId}) on Arc`}
                    className="text-slate-500 transition hover:text-slate-700"
                  >
                    {inner}
                  </a>
                ) : (
                  <span className="text-slate-500">{inner}</span>
                )
              })()
            ) : (
              <span className="text-slate-400">unregistered</span>
            )}
            {typeof node.reputation === 'number' && (
              (() => {
                const readLink = arcContractReadLink(node.registryAddress)
                const repColor =
                  node.reputation > 0
                    ? 'text-[#10F3B5]'
                    : node.reputation < 0
                      ? 'text-[#FF3B5C]'
                      : 'text-slate-700'
                const inner = (
                  <>
                    REP{' '}
                    <span className={`tabular-nums ${repColor}`}>
                      {node.reputation > 0 ? '+' : ''}
                      {node.reputation}
                    </span>
                  </>
                )
                return readLink ? (
                  <a
                    href={readLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`read reputation(${node.agentTokenId ?? '…'}) on Arc`}
                    className="text-slate-500 transition hover:text-slate-700"
                  >
                    {inner}
                  </a>
                ) : (
                  <span className="text-slate-500">{inner}</span>
                )
              })()
            )}
          </div>
        )}

        <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Latency sparkline */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.14em] text-slate-400">LATENCY · ms</span>
            <span className={`font-mono text-[11px] tabular-nums ${offline ? 'text-slate-400' : 'text-slate-700'}`}>
              {offline ? '—' : `${Math.round(node.selfLatencyMs)}`}
            </span>
          </div>
          <div className="mt-2">
            <Sparkline data={node.latencyHistory} accent={accent} dim={offline} height={36} width={260} />
          </div>
        </div>

        {/* Earnings & metrics grid */}
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <div className="font-mono text-[10px] tracking-[0.14em] text-slate-400">EARNINGS · 24H</div>
            <div className={`mt-1 font-mono text-[15px] font-semibold tabular-nums ${offline ? 'text-slate-400' : 'text-slate-900'}`}>
              ${node.earnings24hUsdc.toFixed(5)}
              <span className="ml-1 text-[10px] text-slate-500">USDC</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.14em] text-slate-400">BALANCE</div>
            <div className={`mt-1 font-mono text-[15px] font-semibold tabular-nums ${offline ? 'text-slate-400' : 'text-slate-700'}`}>
              ${node.walletBalanceUsdc.toFixed(4)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.14em] text-slate-400">QUERIES · 1H</div>
            <div className={`mt-1 font-mono text-[15px] font-semibold tabular-nums ${offline ? 'text-slate-400' : 'text-slate-900'}`}>
              {node.queries1h}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.14em] text-slate-400">EVIDENCE · 24H</div>
            <div className={`mt-1 font-mono text-[15px] font-semibold tabular-nums ${offline ? 'text-slate-400' : 'text-slate-900'}`}>
              {node.evidenceServed24h.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <AccuracyBar value={node.accuracy} offline={offline} />
        </div>

        <div className="mt-5 h-px w-full bg-slate-100" />

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between font-mono text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-500">
            <span className={`inline-block h-1 w-1 rounded-full ${offline ? 'bg-slate-300' : 'bg-[#10F3B5]'}`} />
            <span>uptime</span>
            <span className={`tabular-nums ${offline ? 'text-slate-400' : 'text-slate-700'}`}>
              {fmtUptime(node.uptimeSec)}
            </span>
          </div>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-1.5 text-slate-500 transition hover:text-slate-700"
            title={node.walletAddress}
          >
            <span>wallet</span>
            <span className={`tabular-nums ${offline ? 'text-slate-400' : 'text-slate-700'}`}>
              {fmtAddr(node.walletAddress)}
            </span>
          </a>
        </div>

        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-1 rounded-full bg-[#0052ff] animate-pulse" />
            <span>heartbeat</span>
            <HeartbeatAgo ts={node.lastHeartbeatAt} />
            <span>ago</span>
          </div>
          <button
            onClick={() => {
              const cmd = `pm2 ${killed ? 'restart' : 'stop'} ${node.id}`
              if (navigator.clipboard) navigator.clipboard.writeText(cmd).catch(() => {})
              onToggleKill()
            }}
            title={`copy: pm2 ${killed ? 'restart' : 'stop'} ${node.id}`}
            className={`group cursor-pointer rounded px-2 py-0.5 font-mono text-[9px] tracking-[0.15em] transition ${
              killed
                ? 'bg-[#10F3B5]/15 text-[#10F3B5] hover:bg-[#10F3B5]/25'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
            }`}
          >
            {killed ? '◉ COPY pm2 restart' : '◌ COPY pm2 stop'}
          </button>
        </div>
      </div>
    </div>
  )
}
