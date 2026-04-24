/**
 * Non-sensitive configuration for local development.
 * Selected when Vite mode !== "production" (i.e. `npm run dev`).
 */

export type WebappChainEntry = {
  betFactoryAddress: `0x${string}`
  usdcAddress: `0x${string}`
  priceOracleFactoryAddress: `0x${string}`
  eventBetFactoryAddress: `0x${string}`
  explorerUrl: string
  isTestnet: boolean
}

export type WebappEnvConfig = {
  botApiUrl: string
  betPorAddress: `0x${string}`
  chains: Record<number, WebappChainEntry>
}

const config: WebappEnvConfig = {
  botApiUrl: "https://polypop.club",
  betPorAddress: "0x0000000000000000000000000000000000000000",

  chains: {
    84532: {
      betFactoryAddress: "0x7d2b18a988c38b027420B6F162C1685c4c815e3A",
      usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      priceOracleFactoryAddress: "0x0000000000000000000000000000000000000000",
      eventBetFactoryAddress: "0x0000000000000000000000000000000000000000",
      explorerUrl: "https://sepolia.basescan.org",
      isTestnet: true,
    },
    8453: {
      betFactoryAddress: "0x0000000000000000000000000000000000000000",
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      priceOracleFactoryAddress: "0x0000000000000000000000000000000000000000",
      eventBetFactoryAddress: "0x0000000000000000000000000000000000000000",
      explorerUrl: "https://basescan.org",
      isTestnet: false,
    },
    5042002: {
      betFactoryAddress: "0x0000000000000000000000000000000000000000",
      usdcAddress: "0x0000000000000000000000000000000000000000",
      priceOracleFactoryAddress: "0x0000000000000000000000000000000000000000",
      eventBetFactoryAddress: "0x0000000000000000000000000000000000000000",
      explorerUrl: "https://testnet.arcscan.app",
      isTestnet: true,
    },
  },
}

export default config
