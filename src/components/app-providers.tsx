'use client'

import { useAuth } from '@/lib/use-auth'
import { LeagueProvider } from '@/lib/league-context'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()

  return <LeagueProvider userId={userId}>{children}</LeagueProvider>
}
