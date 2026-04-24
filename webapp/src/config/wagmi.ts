import { http, createConfig } from 'wagmi'
import { baseSepolia, base } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { arcTestnet } from './chains'

const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || ''
const BASE_RPC_URL = import.meta.env.VITE_BASE_RPC_URL || undefined
const BASE_SEPOLIA_RPC_URL = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || undefined

// All chains the app supports — add more here as needed
const chains = [baseSepolia, base, arcTestnet] as const

export const config = createConfig({
  chains,
  connectors: [
    injected(),
    ...(WALLETCONNECT_PROJECT_ID
      ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })]
      : []),
  ],
  transports: {
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC_URL),
    [base.id]: http(BASE_RPC_URL),
    [arcTestnet.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
