import type { NanoPayment, NanopayStatus } from '@/types/swarm'
import { arcTxLink } from '@/lib/explorer'

type Props = {
  events: NanoPayment[]
}

const KIND_LABEL: Record<NanoPayment['kind'], string> = {
  evidence: 'evidence',
  summarize: 'summarize',
  verdict: 'verdict',
}

const KIND_COLOR: Record<NanoPayment['kind'], string> = {
  evidence: '#0052ff',
  summarize: '#FFC44D',
  verdict: '#10F3B5',
}

const STATUS_META: Record<NanopayStatus, { label: string; color: string; dot: string }> = {
  received: { label: 'RECEIVED', color: '#0052ff', dot: 'bg-[#0052ff]' },
  batched: { label: 'BATCHED', color: '#FFC44D', dot: 'bg-[#FFC44D]' },
  confirmed: { label: 'CONFIRMED', color: '#0052ff', dot: 'bg-[#0052ff]' },
  completed: { label: 'SETTLED', color: '#10F3B5', dot: 'bg-[#10F3B5]' },
  failed: { label: 'FAILED', color: '#FF3B5C', dot: 'bg-[#FF3B5C]' },
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`
}

function fmtTx(tx: string): string {
  return `${tx.slice(0, 6)}…${tx.slice(-4)}`
}

function fmtBatch(id: string): string {
  return `${id.slice(0, 8)}`
}

type Group =
  | { kind: 'batch'; batchId: string; events: NanoPayment[] }
  | { kind: 'solo'; event: NanoPayment }

/**
 * Partition the time-sorted event list into consecutive batches so the UI
 * visually clusters same-round nanopays. Keeps strict time order so the feel
 * of "new at the top" is preserved — a batch that stops getting new events
 * will scroll down as newer ones arrive.
 */
function groupByBatch(events: NanoPayment[]): Group[] {
  const groups: Group[] = []
  for (const e of events) {
    if (!e.batchId) {
      groups.push({ kind: 'solo', event: e })
      continue
    }
    const head = groups[groups.length - 1]
    if (head && head.kind === 'batch' && head.batchId === e.batchId) {
      head.events.push(e)
    } else {
      groups.push({ kind: 'batch', batchId: e.batchId, events: [e] })
    }
  }
  return groups
}

/**
 * Roll per-batch status up to the "weakest link" — if any row is still
 * `received`, the batch is still `received`. This matches how Circle actually
 * batches (all rows in a round progress together).
 */
function summarizeBatch(rows: NanoPayment[]): {
  status: NanopayStatus
  settlementTxHash: string | null
  totalUsdc: number
} {
  const order: NanopayStatus[] = ['received', 'batched', 'confirmed', 'completed', 'failed']
  let weakest: NanopayStatus = 'completed'
  let weakestIdx = order.indexOf(weakest)
  let settlementTxHash: string | null = null
  let totalUsdc = 0

  for (const r of rows) {
    totalUsdc += r.amountUsdc
    const s = (r.status ?? 'received') as NanopayStatus
    if (s === 'failed') {
      return { status: 'failed', settlementTxHash, totalUsdc }
    }
    const idx = order.indexOf(s)
    if (idx < weakestIdx) {
      weakestIdx = idx
      weakest = s
    }
    if (r.settlementTxHash && !settlementTxHash) settlementTxHash = r.settlementTxHash
  }
  return { status: weakest, settlementTxHash, totalUsdc }
}

export function EventTicker({ events }: Props) {
  const groups = groupByBatch(events)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_-4px_rgba(0,82,255,0.06)]">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0052ff] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0052ff]" />
          </span>
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.22em] text-slate-900">
            NANOPAYMENT STREAM · x402
          </h3>
          <span className="ml-2 rounded-sm border border-[#10F3B5]/30 bg-[#10F3B5]/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-[#10F3B5]">
            CIRCLE GATEWAY · BATCHED
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.16em] text-slate-400">
          <LegendDot color="#0052ff" label="EVIDENCE $0.001" />
          <LegendDot color="#FFC44D" label="SUMMARIZE $0.003" />
          <LegendDot color="#10F3B5" label="VERDICT $0.005" />
        </div>
      </div>

      <div className="relative">
        <div
          className="max-h-[560px] overflow-y-auto overflow-x-hidden scroll-smooth [scrollbar-gutter:stable] [scrollbar-color:rgba(0,0,0,0.1)_transparent] [scrollbar-width:thin]"
          style={{ contain: 'paint' }}
        >
          {events.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center font-mono text-[11px] text-slate-400">
              waiting for swarm activity…
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map((g, gi) =>
                g.kind === 'solo' ? (
                  <SoloRow key={g.event.id} event={g.event} fade={Math.max(0.45, 1 - gi * 0.008)} />
                ) : (
                  <BatchBlock key={`${g.batchId}-${gi}`} batchId={g.batchId} events={g.events} fade={Math.max(0.5, 1 - gi * 0.006)} />
                ),
              )}
            </ul>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  )
}

function SoloRow({ event: e, fade }: { event: NanoPayment; fade: number }) {
  const href = arcTxLink(e.settlementTxHash ?? e.txHash)
  const label = e.settlementTxHash ? fmtTx(e.settlementTxHash) : e.txHash.startsWith('0x') && e.txHash.length === 66 ? fmtTx(e.txHash) : 'pending'
  return (
    <li
      className="grid grid-cols-[90px_36px_1fr_90px_70px_100px] items-center gap-3 px-5 py-2 font-mono text-[11px] animate-[event-slide_0.4s_ease-out]"
      style={{ opacity: fade }}
    >
      <span className="tabular-nums text-slate-400">{fmtTime(e.ts)}</span>
      <span className="text-xl leading-none">{e.oracleEmoji}</span>
      <span className="truncate text-slate-700">
        <span className="text-slate-900">{e.oracleName}</span>
        <span className="text-slate-400"> · </span>
        <span style={{ color: KIND_COLOR[e.kind] }}>{KIND_LABEL[e.kind]}</span>
        {e.verdict && (
          <>
            <span className="text-slate-400"> → </span>
            <span className={e.verdict === 'YES' ? 'text-[#10F3B5]' : 'text-[#FF3B5C]'}>{e.verdict}</span>
            <span className="ml-1 text-slate-500">{e.confidence?.toFixed(2)}</span>
          </>
        )}
      </span>
      <span className="tabular-nums text-[#10F3B5]">${e.amountUsdc.toFixed(4)}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="tabular-nums text-slate-500 transition hover:text-[#0052ff] hover:underline"
          title={e.settlementTxHash ?? e.txHash}
        >
          {label}
        </a>
      ) : (
        <span className="tabular-nums text-slate-500" title={e.settlementTxHash ?? e.txHash}>
          {label}
        </span>
      )}
      <span className="font-mono text-[9px] tracking-[0.16em] text-slate-400 text-right">ARC · SETTLED</span>
    </li>
  )
}

function BatchBlock({ batchId, events, fade }: { batchId: string; events: NanoPayment[]; fade: number }) {
  const { status, settlementTxHash, totalUsdc } = summarizeBatch(events)
  const meta = STATUS_META[status]
  const href = arcTxLink(settlementTxHash)

  return (
    <li className="relative" style={{ opacity: fade }}>
      {/* Colored rail marking the entire batch block — visual proof of grouping */}
      <span
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: `linear-gradient(180deg, ${meta.color}cc, ${meta.color}33)` }}
      />

      {/* Batch header */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 bg-slate-50 px-5 py-2 pl-6">
        <div className="flex min-w-0 items-center gap-3 font-mono text-[10px] tracking-[0.18em]">
          <span
            className="rounded-sm px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em]"
            style={{
              background: `${meta.color}22`,
              color: meta.color,
              border: `1px solid ${meta.color}66`,
            }}
          >
            BATCH
          </span>
          <span className="tabular-nums text-slate-700">#{fmtBatch(batchId)}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-700">
            <span className="tabular-nums">{events.length}</span>{' '}
            <span className="text-slate-500">payments</span>
          </span>
          <span className="text-slate-400">·</span>
          <span className="tabular-nums text-[#10F3B5]">${totalUsdc.toFixed(4)}</span>
          <span className="text-slate-400">·</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${status === 'received' || status === 'batched' ? 'animate-pulse' : ''}`} />
            <span className="tracking-[0.22em]" style={{ color: meta.color }}>
              {meta.label}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded border border-[#10F3B5]/30 bg-[#10F3B5]/10 px-2 py-0.5 tabular-nums text-[#10F3B5] transition hover:bg-[#10F3B5]/20"
              title={settlementTxHash ?? undefined}
            >
              <span className="text-[9px] tracking-[0.18em] text-slate-500">ONCHAIN</span>
              <span>{settlementTxHash ? fmtTx(settlementTxHash) : ''}</span>
              <span className="text-[9px] text-slate-500">↗</span>
            </a>
          ) : (
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] tracking-[0.2em] text-slate-500">
              awaiting batch settle…
            </span>
          )}
        </div>
      </div>

      {/* Rows inside the batch */}
      <ul>
        {events.map((e) => (
          <li
            key={e.id}
            className="grid grid-cols-[90px_36px_1fr_90px_70px_100px] items-center gap-3 px-5 py-1.5 pl-6 font-mono text-[11px] animate-[event-slide_0.4s_ease-out]"
          >
            <span className="tabular-nums text-slate-400">{fmtTime(e.ts)}</span>
            <span className="text-xl leading-none">{e.oracleEmoji}</span>
            <span className="truncate text-slate-700">
              <span className="text-slate-900">{e.oracleName}</span>
              <span className="text-slate-400"> · </span>
              <span style={{ color: KIND_COLOR[e.kind] }}>{KIND_LABEL[e.kind]}</span>
              {e.verdict && (
                <>
                  <span className="text-slate-400"> → </span>
                  <span className={e.verdict === 'YES' ? 'text-[#10F3B5]' : 'text-[#FF3B5C]'}>{e.verdict}</span>
                  <span className="ml-1 text-slate-500">{e.confidence?.toFixed(2)}</span>
                </>
              )}
            </span>
            <span className="tabular-nums text-[#10F3B5]">${e.amountUsdc.toFixed(4)}</span>
            <span
              className="tabular-nums text-slate-500"
              title={e.transferId ?? e.txHash}
            >
              {e.transferId ? `xfer ${fmtTx(e.transferId)}` : 'pending'}
            </span>
            <span className="font-mono text-[9px] tracking-[0.16em] text-slate-400 text-right">via BATCH</span>
          </li>
        ))}
      </ul>
    </li>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </span>
  )
}
