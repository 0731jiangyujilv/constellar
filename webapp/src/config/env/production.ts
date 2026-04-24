/**
 * Non-sensitive configuration for production.
 * Selected when Vite mode === "production" (i.e. `npm run build`).
 */
import type { WebappEnvConfig } from "./local"

const config: WebappEnvConfig = {
  botApiUrl: "https://polypop.club",
  betPorAddress: "0x0000000000000000000000000000000000000000",

  chains: {
    84532: {
      betFactoryAddress: "0xa548BD2E738b157Ee4fFc3Ee9A3444C1B8056a00",
      usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      eventBetFactoryAddress: "0x21A1e04521Ac467eb053419D791ac9F7d401daAA",
      priceOracleFactoryAddress: "0xc3f06B9D116B2F3522F7731d5Eed7B63714AAA2F",
      explorerUrl: "https://sepolia.basescan.org",
      isTestnet: true,
    },
    8453: {
      betFactoryAddress: "0x2Aa1ABd3598e21DcA0a9412ba55E0e6fA100d9C6",
      eventBetFactoryAddress: "0x0000000000000000000000000000000000000000",
      priceOracleFactoryAddress: "0xa8873f14788cd94eF6b364994a1574bD7F4D678E",
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      explorerUrl: "https://basescan.org",
      isTestnet: false,
    },
    // Uncomment when Arc Testnet contracts are deployed:
    5042002: {
      betFactoryAddress: "0xb9757A465EbA11ADf184e8F9F3744765cf0e0eb3",
      usdcAddress: "0x3600000000000000000000000000000000000000",
      eventBetFactoryAddress: "0x201d6eFDC97a45419490D3F28c9d0Cbb4a603F6F",
      priceOracleFactoryAddress: "0x7193499abD9E27C46Ded1eDbcaeca786D7a1535a",
      explorerUrl: "https://testnet.arcscan.app/",
      isTestnet: true,
    },
  },
}

export default config
