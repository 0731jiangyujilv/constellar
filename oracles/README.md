# Oracle Swarm

5 autonomous Gemini-based oracle agents that resolve prediction-market events via x402 Nanopayments on Arc.

## Layout

```
oracles/
├── ecosystem.config.cjs            pm2 manifest (5 nodes)
├── .env.example                    env template
├── src/
│   ├── common/
│   │   ├── config.ts               zod env + PERSONAS + PRICE_USDC_MICRO
│   │   ├── types.ts                EvidenceItem / Verdict / HeartbeatPayload
│   │   ├── x402-server.ts          402-Pay-retry middleware (mock | live)
│   │   ├── gemini.ts               Gemini 2.0 flash (score/summarize/verdict)
│   │   ├── heartbeat.ts            setInterval POST to bot
│   │   ├── oracle-app.ts           shared Express factory (3 tiers)
│   │   └── stub.ts                 fallback evidence when API keys missing
│   └── nodes/
│       ├── twitter/                X API v2 recent search
│       ├── google/                 Google Custom Search JSON API
│       ├── news/                   GDELT 2.0 Doc API (keyless)
│       ├── reddit/                 reddit.com/search.json (keyless)
│       └── youtube/                YouTube Data API v3
└── scripts/
    ├── boot-all.sh                 pm2 wrapper (start/stop/status/logs)
    └── smoke-test.sh               curl-based 402→pay→200 check
```

## Ports

| node  | id                    | port | source |
|-------|-----------------------|------|--------|
| 🐦    | oracle-twitter-01     | 4001 | X API |
| 🔎    | oracle-google-02      | 4002 | Google CSE |
| 📰    | oracle-news-03        | 4003 | GDELT |
| 👽    | oracle-reddit-04      | 4004 | Reddit |
| 📺    | oracle-youtube-05     | 4005 | YouTube |

## Running

```bash
cp .env.example .env          # fill GEMINI_API_KEY + (optional) upstream keys
npm install
npm run swarm:start           # pm2 start ecosystem.config.cjs
pm2 ls                        # confirm 5 online
pm2 logs                      # tail color-coded logs

# demo kill trick
pm2 stop    oracle-youtube-05
pm2 restart oracle-youtube-05

npm run swarm:stop            # stop all
npm run swarm:delete          # remove from pm2
```

## Tiered API (each node exposes the same 3 endpoints)

```
GET  /evidence?topic=<q>&cursor=<c>    402  $0.001 / item   → { id, text, url, author, timestamp, cursor, txHash }
POST /summarize  { question, evidence } 402  $0.003 / call   → { summary, relevance, txHash }
POST /verdict    { question, summary }  402  $0.005 / call   → { verdict, confidence, reasoning, cites, txHash }
GET  /health                                                 → { ok, persona, uptimeSec }
```

One event resolution = 5 nodes × (5 evidence + 1 summarize + 1 verdict) = **35 nanopayments / event**.

## x402 modes

- `X402_MODE=mock` (default): middleware generates deterministic fake tx hashes — lets the whole flow run end-to-end without real USDC. Every 402 → X-PAYMENT header (any value) → 200.
- `X402_MODE=live`: middleware POSTs the payment header to `X402_FACILITATOR_URL/verify` + `/settle`. Returns the real Arc tx hash.

Swap modes by editing `.env` and restarting pm2.

## Heartbeat protocol

Every node `setInterval`s a POST to `BOT_HEARTBEAT_URL` (default `http://localhost:3000/api/swarm/heartbeat`). The bot-side endpoints are:

```
POST /api/swarm/heartbeat      ← oracles push here
GET  /api/swarm/snapshot       ← one-shot dashboard fetch
GET  /api/swarm/stream         ← SSE live stream for dashboard
```

Cadence is staggered (5 / 7 / 8 / 6 / 9 s) so the dashboard sees an organic pulse rather than a metronome.

## Smoke test (after swarm is up)

```bash
./scripts/smoke-test.sh "BTC ETF approval"
```

Expected output:

```
  twitter    :4001  OK  402→pay→200  0xab12…
  google     :4002  OK  402→pay→200  0xcd34…
  news       :4003  OK  402→pay→200  0xef56…
  reddit     :4004  OK  402→pay→200  0x7890…
  youtube    :4005  OK  402→pay→200  0xfe12…
✓ all 5 oracles passed x402 handshake
```
