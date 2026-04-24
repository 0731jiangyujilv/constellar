import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAccount, useChainId, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'
import { BOT_API_URL, getAuthToken, setAuthToken, clearAuthToken } from '@/lib/api'
import { isSupportedChain } from '@/config/chains'

export type AuthState = {
  isAuthenticated: boolean
  isSigningIn: boolean
  address: string | null
  chainId: number | null
  signIn: () => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isSigningIn: false,
  address: null,
  chainId: null,
  signIn: async () => {},
  signOut: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [authAddress, setAuthAddress] = useState<string | null>(null)
  const [authChainId, setAuthChainId] = useState<number | null>(null)

  // Check existing token on mount and when wallet changes
  useEffect(() => {
    const token = getAuthToken()
    if (!token || !isConnected) {
      setIsAuthenticated(false)
      setAuthAddress(null)
      setAuthChainId(null)
      return
    }

    // Verify the token is still valid
    fetch(`${BOT_API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Invalid session')
      })
      .then((data) => {
        // Token is valid but if address changed, clear it
        if (data.address.toLowerCase() !== address?.toLowerCase()) {
          clearAuthToken()
          setIsAuthenticated(false)
          setAuthAddress(null)
          setAuthChainId(null)
        } else {
          setIsAuthenticated(true)
          setAuthAddress(data.address)
          setAuthChainId(data.chainId)
        }
      })
      .catch(() => {
        clearAuthToken()
        setIsAuthenticated(false)
        setAuthAddress(null)
        setAuthChainId(null)
      })
  }, [address, isConnected])

  // Clear auth when disconnected
  useEffect(() => {
    if (!isConnected) {
      clearAuthToken()
      setIsAuthenticated(false)
      setAuthAddress(null)
      setAuthChainId(null)
    }
  }, [isConnected])

  const signIn = useCallback(async () => {
    if (!address || !isConnected || !isSupportedChain(chainId)) return

    setIsSigningIn(true)
    try {
      // 1. Fetch nonce
      const nonceRes = await fetch(`${BOT_API_URL}/api/auth/nonce`)
      const { nonce } = await nonceRes.json()

      // 2. Create SIWE message
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to PolyPOP BetSys',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      })
      const messageStr = message.prepareMessage()

      // 3. Sign message
      const signature = await signMessageAsync({ message: messageStr })

      // 4. Verify with backend
      const verifyRes = await fetch(`${BOT_API_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageStr, signature }),
      })

      if (!verifyRes.ok) {
        const err = await verifyRes.json()
        throw new Error(err.error || 'Verification failed')
      }

      const { token, address: verifiedAddr, chainId: verifiedChainId } = await verifyRes.json()

      setAuthToken(token)
      setIsAuthenticated(true)
      setAuthAddress(verifiedAddr)
      setAuthChainId(verifiedChainId)
    } catch (err: any) {
      console.error('SIWE sign-in failed:', err)
      clearAuthToken()
      setIsAuthenticated(false)
    } finally {
      setIsSigningIn(false)
    }
  }, [address, isConnected, chainId, signMessageAsync])

  const signOut = useCallback(() => {
    const token = getAuthToken()
    if (token) {
      fetch(`${BOT_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    clearAuthToken()
    setIsAuthenticated(false)
    setAuthAddress(null)
    setAuthChainId(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isSigningIn,
        address: authAddress,
        chainId: authChainId,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
