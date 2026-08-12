'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { League } from '@/lib/database.types'
import { loadProfile } from '@/lib/profile'
import { supabase } from '@/lib/supabase'

const STORAGE_KEY = 'tsw_active_league_id'

export interface LeagueMembership {
  league_id: string
  bankroll: number
  is_commissioner: boolean
  is_member: boolean
  leagues: League | null
}

interface LeagueContextValue {
  memberships: LeagueMembership[]
  activeLeagueId: string | null
  activeMembership: LeagueMembership | null
  activeLeague: League | null
  isAdministrator: boolean
  isCommissioner: boolean
  canManageActiveLeague: boolean
  loading: boolean
  setActiveLeagueId: (leagueId: string) => void
  refreshMemberships: () => Promise<void>
}

const LeagueContext = createContext<LeagueContextValue | null>(null)

export function LeagueProvider({
  userId,
  children,
}: {
  userId: string | null
  children: ReactNode
}) {
  const [memberships, setMemberships] = useState<LeagueMembership[]>([])
  const [activeLeagueId, setActiveLeagueIdState] = useState<string | null>(null)
  const [isAdministrator, setIsAdministrator] = useState(false)
  const [loading, setLoading] = useState(true)

  const refreshMemberships = useCallback(async () => {
    if (!userId) {
      setMemberships([])
      setActiveLeagueIdState(null)
      setIsAdministrator(false)
      setLoading(false)
      return
    }

    const profileResult = await loadProfile()
    const administrator = profileResult.profile?.is_administrator ?? false
    setIsAdministrator(administrator)

    const { data, error } = await supabase
      .from('league_members')
      .select('league_id, bankroll, is_commissioner, leagues(id, name, created_by, created_at)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })

    if (error) {
      setLoading(false)
      return
    }

    const memberRows: LeagueMembership[] = (data ?? []).map((row) => ({
      league_id: row.league_id,
      bankroll: row.bankroll,
      is_commissioner: row.is_commissioner,
      is_member: true,
      leagues: row.leagues,
    }))

    let rows = memberRows

    if (administrator) {
      const { data: allLeagues, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, created_by, created_at')
        .order('created_at', { ascending: true })

      if (!leaguesError && allLeagues) {
        const memberByLeagueId = new Map(memberRows.map((row) => [row.league_id, row]))

        rows = allLeagues.map((league) => {
          const existing = memberByLeagueId.get(league.id)
          if (existing) return existing

          return {
            league_id: league.id,
            bankroll: 0,
            is_commissioner: false,
            is_member: false,
            leagues: league,
          }
        })
      }
    }

    setMemberships(rows)

    const storedId =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    const nextId =
      rows.find((row) => row.league_id === storedId)?.league_id ??
      rows[0]?.league_id ??
      null

    setActiveLeagueIdState(nextId)
    if (nextId && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, nextId)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    setLoading(true)
    refreshMemberships()
  }, [refreshMemberships])

  const setActiveLeagueId = useCallback((leagueId: string) => {
    setActiveLeagueIdState(leagueId)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, leagueId)
    }
  }, [])

  const activeMembership = useMemo(
    () => memberships.find((row) => row.league_id === activeLeagueId) ?? null,
    [memberships, activeLeagueId]
  )

  const canManageActiveLeague = useMemo(
    () => isAdministrator || (activeMembership?.is_commissioner ?? false),
    [isAdministrator, activeMembership]
  )

  const value = useMemo(
    () => ({
      memberships,
      activeLeagueId,
      activeMembership,
      activeLeague: activeMembership?.leagues ?? null,
      isAdministrator,
      isCommissioner: activeMembership?.is_commissioner ?? false,
      canManageActiveLeague,
      loading,
      setActiveLeagueId,
      refreshMemberships,
    }),
    [
      memberships,
      activeLeagueId,
      activeMembership,
      isAdministrator,
      canManageActiveLeague,
      loading,
      setActiveLeagueId,
      refreshMemberships,
    ]
  )

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>
}

export function useLeague() {
  const context = useContext(LeagueContext)
  if (!context) {
    throw new Error('useLeague must be used within LeagueProvider')
  }
  return context
}

export function setActiveLeagueIdExternal(leagueId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, leagueId)
  }
}
