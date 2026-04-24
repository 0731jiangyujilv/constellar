import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Logo } from '@/components/Logo'
import { ExploreMarketCard, type ExploreMarket } from '@/components/ExploreMarketCard'
import { BOT_API_URL } from '@/lib/api'

async function fetchActiveMarkets(): Promise<ExploreMarket[]> {
  const res = await fetch(`${BOT_API_URL}/api/x/proposals?status=OPEN,LOCKED&limit=60`)
  if (!res.ok) throw new Error(`Failed to load markets (${res.status})`)
  return res.json()
}

function SkeletonCard() {
  return (
    <div className="h-[280px] animate-pulse rounded-[28px] border border-[rgba(20,20,20,0.08)] bg-[rgba(20,20,20,0.04)]" />
  )
}

export function ExploreMarketPage() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['x-proposals', 'active'],
    queryFn: fetchActiveMarkets,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const markets = data ?? []

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-ink)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,82,255,0.08),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(0,82,255,0.06),transparent_18%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-8 md:px-10">
        <header className="mb-8 flex items-center justify-between">
          <Logo />
          <Link
            to="/"
            className="text-sm text-[var(--color-muted)] tracking-[0.18em] uppercase hover:text-[var(--color-ink)]"
          >
            ← Home
          </Link>
        </header>

        <section className="mb-10">
          <div className="inline-flex rounded-xl border border-[rgba(0,82,255,0.35)] bg-[rgba(0,82,255,0.04)] px-5 py-2 text-xs tracking-[0.2em] text-[var(--color-cyan)] uppercase">
            Live markets
          </div>
          <h1 className="mt-6 max-w-[720px] text-4xl leading-[1.12] font-semibold tracking-[-0.02em] md:text-5xl md:leading-[1.06]">
            Every open bet, in one place.
          </h1>
          <p className="mt-5 max-w-[720px] text-base leading-7 text-[var(--color-muted)] md:text-lg">
            Browse bets from X right now. Tap one to see the pool, read the call, and put your money where your take is.
          </p>
        </section>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {isError && (
          <div className="rounded-[24px] border border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.06)] p-6">
            <p className="text-base font-semibold text-[var(--color-down)]">Couldn&apos;t load live markets.</p>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{(error as Error)?.message ?? 'Unknown error'}</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="mt-4 rounded-full border border-[rgba(20,20,20,0.22)] bg-white px-5 py-2 text-sm transition hover:bg-[rgba(255,255,255,0.65)] disabled:opacity-50"
            >
              {isRefetching ? 'Retrying…' : 'Try again'}
            </button>
          </div>
        )}

        {!isLoading && !isError && markets.length === 0 && (
          <div className="rounded-[28px] border border-[rgba(20,20,20,0.12)] bg-[#efefe9] p-10 text-center">
            <p className="text-2xl font-semibold tracking-[-0.01em]">No live markets right now.</p>
            <p className="mt-3 text-base text-[var(--color-muted)]">
              Be the first — tweet a prediction at{' '}
              <a
                href="https://x.com/_PolyPOP"
                target="_blank"
                rel="noopener noreferrer"
                className="!text-[var(--color-cyan)] hover:underline"
              >
                @_PolyPOP
              </a>{' '}
              to spin up a bet.
            </p>
          </div>
        )}

        {!isLoading && !isError && markets.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {markets.map((m) => (
              <ExploreMarketCard key={m.uuid} market={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
