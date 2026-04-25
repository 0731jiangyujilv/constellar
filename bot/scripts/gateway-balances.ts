/**
 * Quick read-only check of wallet + Gateway balances for the bot's EOA.
 *
 * Usage: npm run gateway:balances
 */
import "dotenv/config"
import { GatewayClient } from "@circle-fin/x402-batching/client"

async function main() {
  const pk = process.env.BOT_PRIVATE_KEY
  if (!pk) {
    console.error("BOT_PRIVATE_KEY is required")
    process.exit(1)
  }

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  })

  const b = await client.getBalances()
  console.log(`address:         ${client.address}`)
  console.log(`chain:           ${client.chainName} (domain ${client.domain})`)
  console.log(`wallet USDC:     ${b.wallet.formatted}`)
  console.log(`gateway total:   ${b.gateway.formattedTotal}`)
  console.log(`  available:     ${b.gateway.formattedAvailable}`)
  console.log(`  withdrawing:   ${b.gateway.formattedWithdrawing}`)
  console.log(`  withdrawable:  ${b.gateway.formattedWithdrawable}`)
}

main().catch((err) => {
  console.error("balances failed:", err?.shortMessage ?? err?.message ?? err)
  process.exit(1)
})
