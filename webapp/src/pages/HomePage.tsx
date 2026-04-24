import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

export function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg-0)] text-[var(--color-ink)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,82,255,0.08),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(0,82,255,0.06),transparent_18%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-8 md:px-10">
        <header className="mb-10">
          <Logo />
        </header>
      <main className="grid w-full gap-8 lg:grid-cols-[1fr_0.92fr] lg:items-start">
        <section>
          <div className="inline-flex rounded-xl border border-[rgba(0,82,255,0.35)] bg-[rgba(0,82,255,0.04)] px-5 py-2 text-xs tracking-[0.2em] text-[var(--color-cyan)] uppercase">
            X-native prediction markets
          </div>
          <h1 className="mt-8 max-w-[700px] text-4xl leading-[1.12] font-semibold tracking-[-0.02em] md:text-6xl md:leading-[1.06]">
            Tweet a prediction. Make it a bet.
          </h1>
          <p className="mt-8 max-w-[760px] text-lg leading-8 text-[var(--color-muted)] md:text-xl">
            Anyone on X can call their shot and turn it into a live onchain market in seconds.
            No code. No exchange. Just your take — and everyone else&apos;s money on the line.
          </p>

          <div className="mt-8 h-px w-full bg-[rgba(20,20,20,0.12)]" />

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              ['1,247', 'MARKETS CREATED'],
              ['$84,300', 'TOTAL POOLED'],
              ['6,891', 'BETS PLACED'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-3xl font-semibold tracking-[-0.01em] md:text-4xl">{value}</p>
                <p className="mt-2 text-sm leading-[1.4] tracking-[0.18em] text-[var(--color-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="rounded-[34px] border border-[rgba(20,20,20,0.12)] bg-[#efefe9] p-7 md:p-9">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-[rgba(0,82,255,0.2)]">
                <img
                  src="/V3HzkgSf_400x400.jpg"
                  alt="Mr. Grover avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-xl leading-none font-semibold tracking-[-0.01em]">Mr. Grover</p>
                <p className="mt-2 text-base leading-none text-[var(--color-muted)]">@Mr__Grover__</p>
              </div>
            </div>

            <p className="mt-6 text-xl leading-[1.3] tracking-[-0.01em] md:text-2xl">
              <a href="https://x.com/_PolyPOP" target="_blank" rel="noopener noreferrer" className="!text-[var(--color-cyan)] hover:underline">@_PolyPOP</a> BTC hits $100k before July 1st?
            </p>

            <div className="mt-8 rounded-[28px] border border-[rgba(20,20,20,0.12)] bg-white p-6">
              <div className="flex items-center justify-between text-sm text-[var(--color-muted)] md:text-base">
                <p>234 bets</p>
                <p>Closes June 30</p>
              </div>
              <p className="mt-4 text-3xl leading-none font-semibold tracking-[-0.02em] md:text-4xl">$12,400 <span className="text-xl font-normal text-[var(--color-muted)] md:text-2xl">in pool</span></p>

              <div className="mt-8 h-4 rounded-full bg-[#d5d5d5]">
                <div className="h-full w-[62%] rounded-full bg-[var(--color-cyan)]" />
              </div>

              <div className="mt-5 flex items-center justify-between text-xl leading-none text-[var(--color-muted)] md:text-2xl">
                <p>
                  <span className="text-[var(--color-ink)]">62%</span> Yes
                </p>
                <p>
                  <span className="text-[var(--color-ink)]">38%</span> No
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <a
              href="https://x.com/_PolyPOP"
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-[24px] border border-[rgba(20,20,20,0.22)] bg-white px-8 py-5 text-center text-sm leading-none tracking-[-0.01em] transition hover:bg-[rgba(255,255,255,0.65)] md:text-base"
            >
              Create your first bet
            </a>
            <Link
              to="/explore"
              className="block w-full rounded-[24px] border border-[rgba(20,20,20,0.22)] bg-white px-8 py-5 text-center text-sm leading-none tracking-[-0.01em] transition hover:bg-[rgba(255,255,255,0.65)] md:text-base"
            >
              Explore live markets
            </Link>
          </div>
        </section>
      </main>
      </div>
    </div>
  )
}
