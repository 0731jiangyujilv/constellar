/**
 * One-off script to deposit USDC from the bot's EOA into Circle's Gateway
 * Wallet contract so subsequent x402 calls can be paid gaslessly.
 *
 * Usage:
 *   npm run gateway:deposit -- <amount_usdc>
 *   e.g. npm run gateway:deposit -- 10
 *
 * Prereqs:
 *   - BOT_PRIVATE_KEY set in env
 *   - The EOA holds USDC on Arc testnet (faucet: https://faucet.circle.com)
 *   - The EOA holds a tiny bit of native gas on Arc testnet (the deposit is
 *     the ONLY on-chain tx the bot ever sends for payments after this).
 */
import "dotenv/config"
import { GatewayClient } from "@circle-fin/x402-batching/client"

async function main() {
  const amount = process.argv[2]
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    console.error("Usage: npm run gateway:deposit -- <amount_usdc>")
    process.exit(1)
  }

  const pk = process.env.BOT_PRIVATE_KEY
  if (!pk) {
    console.error("BOT_PRIVATE_KEY is required")
    process.exit(1)
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  })

  console.log(`buyer address:  ${client.address}`)
  console.log(`chain:          ${client.chainName} (domain ${client.domain})`)

  const before = await client.getBalances()
  console.log(`wallet USDC:    ${before.wallet.formatted}`)
  console.log(`gateway avail:  ${before.gateway.formattedAvailable}`)
  console.log(`depositing:     ${amount} USDC →`)

  const result = await client.deposit(amount)
  if (result.approvalTxHash) {
    console.log(`approval tx:    ${result.approvalTxHash}`)
  }
  console.log(`deposit tx:     ${result.depositTxHash}`)
  console.log(`deposited:      ${result.formattedAmount} USDC`)

  const after = await client.getBalances()
  console.log(`wallet USDC:    ${after.wallet.formatted}`)
  console.log(`gateway avail:  ${after.gateway.formattedAvailable}`)
}

main().catch((err) => {
  console.error("deposit failed:", err?.shortMessage ?? err?.message ?? err)
  process.exit(1)
})
