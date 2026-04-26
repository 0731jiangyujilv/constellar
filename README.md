# Constellar

**Coordinated intelligence for programmable judgment.**

Constellar resolves real-world event markets with a swarm of LLM-powered oracles. Each oracle call is paid at the HTTP layer via **x402** nanopayments, and settlement is moved off the per-call critical path by **Circle Gateway**: the bot deposits USDC once into a Gateway Wallet, signs EIP-3009 authorizations per call, and the Gateway facilitator verifies signatures in an AWS Nitro TEE, nets them, and settles on-chain in batches. Oracle nodes no longer need chain transaction keys at all.

---

## Architecture

### Oracle Swarm + Gateway Nanopayments

![Constellar Oracle Swarm + Gateway Architecture](images/constellar_oracle_swarm_gateway_architecture.svg)

The system has seven layers that mirror the diagram above:

| Layer | Components | Role |
| --- | --- | --- |
| **User Entry Points** | Telegram bot, X/Twitter bot, Web UI + wallet, Constellar Intent Layer | Social and wallet-based ways to create or monitor markets; the intent layer parses market intent, routes funding, and triggers settlement |
| **Frontend · webapp** | Pages (Home / Explore / Bet / EventMarket / CreateMarket / Stats / OracleSwarmPage), hooks (`useSwarmSse`, `useSwarmSimulation`), wagmi + SIWE auth | React + Vite app; streams live consensus and renders `ConsensusCard` with tx links |
| **Bot Backend** | API service (`/api/swarm/stream`, `/snapshot`, `/latest-consensus`, `/heartbeat`, `/nanopay`), workers (event-settlement cron, bet-listener, claim-worker, verify / reconciler), Prisma/Postgres, viem clients, DB-backed `WorkerLease` | Node + Express + Prisma on PM2; state machine and locks |
| **Nanopayments · x402** | HTTP 402 Payment Required, EIP-3009 `TransferWithAuthorization`, `X-PAYMENT` header via `GatewayClient.pay(url)` | Payment negotiation standard; tiers: `/evidence` 1000µ, `/summarize` 3000µ, `/verdict` 5000µ |
| **Circle Gateway** | Gateway Wallet deposit, `createGatewayMiddleware`, AWS Nitro TEE facilitator | Bot deposits USDC once; facilitator verifies signatures, nets, and batch-settles — no per-call source-chain transfer tx |
| **Oracle Swarm** | 5 PM2 Express nodes: twitter `:4001`, google `:4002`, news `:4003`, reddit `:4004`, youtube `:4005` with Gemini reasoning | Evidence and community oracles behind Oracle Middleware; returns evidence → summarize → verdict. **No oracle wallet chain key needed.** |
| **External + On-chain** | Data APIs (X API v2, Google CSE, GDELT 2.0, Reddit, YouTube, Gemini, OpenAI, Coingecko); Arc Testnet (`EventBet.resolve`, `OracleRegistry.applyOutcome`, USDC settlement); Base / other EVM (`BetFactory` → `Bet`, `EventBetFactory` → `EventBet`, `PriceOracleFactory`, Uniswap liquidity demo) | Evidence + LLM sources, Constellar-native Arc settlement and reputation, EVM market contracts |

**Why this matters**
- **Batch settlement instead of tx-per-payment.** Chain work is amortized across many oracle calls.
- **Oracle nodes do not need chain transaction keys.** Signature verification and settlement happen inside the Gateway TEE.
- **Upgrade path.** Old flow: bot signs EIP-3009 → oracle sends `transferWithAuthorization` on Arc per payment. New flow: bot deposits to Gateway Wallet → `GatewayClient.pay(url)` → middleware forwards signature → Gateway TEE verifies/accounts/nets → batched chain settlement.

### Event Settlement Flow

![Constellar Event Settlement Flow](images/constellar_event_settlement_gateway_flow.svg)

The `event-settlement` cron resolves an `EventBet` in five stages:

1. **Trigger + contract read.** PM2 worker leases an unresolved `EventBet`, reads `question()` + topic via viem on Arc, then calls `resolveWithSwarm(q, topic)` on the oracle-aggregator to prepare paid queries.
2. **x402 payment negotiation.** `GatewayClient.pay(url)` spends from the Gateway Wallet balance, receives `402 Payment Required`, creates an EIP-3009 authorization, and sends it as an `X-PAYMENT` header — **no immediate chain tx**. Per-oracle, per-stage accounting is tiered: `/evidence` 1000µ, `/summarize` 3000µ, `/verdict` 5000µ.
3. **Oracle swarm consensus.** Queries fan out in parallel to the 5 oracles (twitter, google, news, reddit, youtube). Each oracle returns **evidence** (source fetch + quote extraction, 1000µ), a **summary** (Gemini reasoning, 3000µ), and a **verdict** (outcome + confidence + rationale, 5000µ). A confidence-weighted vote produces `{outcome, spread, perOracle}`.
4. **Circle Gateway settlement.** Oracles pass `X-PAYMENT` through `createGatewayMiddleware`, which submits signatures to the facilitator. The facilitator runs in an AWS Nitro TEE, performs ledger accounting + netting, and settles in batches later.
5. **Arc state + UI feedback.** The worker calls `EventBet.resolve(outcome, reasoning)` on Arc, emits an SSE consensus event (`recordConsensus(...)` feeding `OracleSwarmPage → ConsensusCard`), and calls `OracleRegistry.applyOutcome(tokenIds, deltas)` to update oracle reputation on Arc.

> **Key change.** Constellar keeps x402 at the HTTP layer, but moves chain settlement to Circle Gateway. Oracles no longer submit `transferWithAuthorization` transactions themselves; Gateway aggregates signatures, performs TEE accounting/netting, and settles in batches.

---

## Key Repository Layout

<pre>
constellar/
├── <a href="contracts/">contracts/</a>                          # Foundry project
│   │   ├── <a href="contracts/src/OracleRegistry.sol">OracleRegistry.sol</a>          # Arc-native oracle reputation + outcome tracking
│   └── <a href="contracts/script/">script/</a>
│       └── <a href="contracts/script/DeployOracleRegistry.s.sol">DeployOracleRegistry.s.sol</a>
│
├── <a href="oracles/">oracles/</a>                            # 5-node PM2 Express swarm
│   └── <a href="oracles/src/">src/</a>
│       └── <a href="oracles/src/nodes/">nodes/</a>
│           ├── <a href="oracles/src/nodes/twitter/">twitter/</a>                # X API v2 evidence oracle  (:4001)
│           ├── <a href="oracles/src/nodes/google/">google/</a>                 # Google CSE evidence oracle (:4002)
│           ├── <a href="oracles/src/nodes/news/">news/</a>                   # GDELT 2.0 news oracle      (:4003)
│           ├── <a href="oracles/src/nodes/reddit/">reddit/</a>                 # Reddit evidence oracle     (:4004)
│           └── <a href="oracles/src/nodes/youtube/">youtube/</a>                # YouTube evidence oracle    (:4005)
│
├── <a href="bot/">bot/</a>                                # Node.js + Express + Prisma backend (PM2)
│   └── <a href="bot/src/">src/</a>
│       ├── <a href="bot/src/common/">common/</a>
│       │   ├── <a href="bot/src/common/middleware/">middleware/</a>             # Auth / rate-limit middleware
│       │       ├── <a href="bot/src/common/services/x402-client.ts">x402-client.ts</a>      # GatewayClient.pay() — EIP-3009 + Circle Gateway wallet
│       ├── <a href="bot/src/event-settlement-worker.ts">event-settlement-worker.ts</a>  # PM2 cron entry — leases + resolves pending EventBets
│       ├── <a href="bot/src/tg/">tg/</a>                         # Telegram bot
│       └── <a href="bot/src/x/">x/</a>                          # X/Twitter bot
│
├── <a href="webapp/">webapp/</a>                             # React + Vite frontend
│       ├── <a href="webapp/src/pages/">pages/</a>
│       │   ├── <a href="webapp/src/pages/EventMarketPage.tsx">EventMarketPage.tsx</a>     # EventBet market view
│       │   ├── <a href="webapp/src/pages/EventMarketCreatePage.tsx">EventMarketCreatePage.tsx</a>
│       ├── <a href="webapp/src/components/">components/</a>
│       │   ├── <a href="webapp/src/components/ConnectWallet.tsx">ConnectWallet.tsx</a>       # SIWE sign-in + wallet connect
│       │   ├── <a href="webapp/src/components/ChainSelector.tsx">ChainSelector.tsx</a>
│
└── <a href="images/">images/</a>                             # Architecture diagrams (source of truth for this README)
    ├── <a href="images/constellar_oracle_swarm_gateway_architecture.svg">constellar_oracle_swarm_gateway_architecture.svg</a>
    └── <a href="images/constellar_event_settlement_gateway_flow.svg">constellar_event_settlement_gateway_flow.svg</a>
</pre>

## Key Technologies

- **NanoPayments:** x402 (HTTP 402 + EIP-3009), Circle Gateway (TEE-based batch settlement), USDC
- **Chains:** Arc Testnet (native settlement + reputation), Base / other EVM (markets + bootstrap liquidity)
- **Backend:** Node.js, Express, Prisma/Postgres, PM2, viem
- **Frontend:** React, Vite, wagmi, SIWE
- **Oracles:** Gemini reasoning over X API v2, Google CSE, GDELT 2.0, Reddit, YouTube
- **Contracts:** Foundry — `EventBet`, `EventBetFactory`, `Bet`, `BetFactory`, `PriceOracleFactory`, `OracleRegistry`

---

## Why Arc + Circle Nanopayments

- **High-frequency judgment requests.** Each market resolution fans out to 5 oracles × 3 stages (evidence / summarize / verdict) — dozens of micro-calls per event. Per-call on-chain transactions would be prohibitively expensive and slow; x402 HTTP 402 + EIP-3009 keeps payment at the network layer with no immediate chain tx.
- **AI agents as oracle nodes for small paid tasks.** Oracle nodes are autonomous agents that earn USDC for each verified evidence or verdict they return. Circle Gateway lets them receive streamed micropayments without ever holding chain transaction keys — the Gateway TEE accounts and batches settlement on their behalf.
- **Outcomes settle in USDC on Arc — onchain, auditable, and verifiable.** The final `EventBet.resolve()` call and `OracleRegistry.applyOutcome()` reputation update are both written to Arc Testnet, creating a permanent, auditable record of every verdict and its on-chain consequences.

## Why Gemini

- **Increase factual accuracy.** Gemini cross-references each oracle's raw evidence against its own knowledge before producing a summary or verdict, reducing the impact of low-quality or stale source material.
- **Reduce hallucinations with Google Search grounding.** Gemini's native Google Search grounding mode anchors responses to live web results rather than relying solely on parametric memory, significantly lowering the rate of invented facts.
- **Access real-time web evidence.** Grounded queries retrieve pages published minutes before resolution, ensuring verdicts reflect the most current state of a real-world event rather than training-data snapshots.
- **Return citations for verification.** Every Gemini response includes source URLs that are stored alongside the verdict, allowing anyone to inspect the evidence chain that produced a market outcome.
