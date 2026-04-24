import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from '@/config/wagmi'
import { AuthProvider } from '@/contexts/AuthContext'
import { HomePage } from '@/pages/HomePage'
import { CreateBetPage } from '@/pages/CreateBetPage'
import { BetPage } from '@/pages/BetPage'
import { StatsPage } from '@/pages/StatsPage'
import { SharePage } from '@/pages/SharePage'
import { EventMarketCreatePage } from '@/pages/EventMarketCreatePage'
import { EventMarketPage } from '@/pages/EventMarketPage'
import { ExploreMarketPage } from '@/pages/ExploreMarketPage'
import { OracleSwarmPage } from '@/pages/OracleSwarmPage'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<ExploreMarketPage />} />
              <Route path="/create/:betId" element={<CreateBetPage />} />
              <Route path="/bet/:contractAddress" element={<BetPage />} />
              <Route path="/share/:contractAddress" element={<SharePage />} />
              <Route path="/event/create/:betId" element={<EventMarketCreatePage />} />
              <Route path="/event/:contractAddress" element={<EventMarketPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/swarm" element={<OracleSwarmPage />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
