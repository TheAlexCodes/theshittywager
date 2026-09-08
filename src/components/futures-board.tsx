'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { BetEntrySection } from '@/components/bet-entry-section'
import { BetStatusBadge } from '@/components/bet-status-badge'
import { BettingWindowCountdown } from '@/components/betting-window-countdown'
import type { Future, LeagueSettings, Week } from '@/lib/database.types'
import { getFuturesWindow } from '@/lib/futures-window'
import { useLeague } from '@/lib/league-context'
import {
  formatAmericanOdds,
  formatMoney,
  remainingAllowance,
  sumStakes,
} from '@/lib/odds'
import { supabase } from '@/lib/supabase'
import { futuresIsLocked, getCurrentBettingWeek, getFuturesWeek } from '@/lib/weeks'

interface FuturesBoardProps {
  userId: string
}

interface FutureRow extends Future {
  player_name: string
}

type FuturesFilter = 'all' | 'mine'

export function FuturesBoard({ userId }: FuturesBoardProps) {
  const { activeLeagueId, activeMembership, memberships } = useLeague()
  const [weeks, setWeeks] = useState<Week[]>([])
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings | null>(null)
  const [futures, setFutures] = useState<FutureRow[]>([])
  const [filter, setFilter] = useState<FuturesFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFutures = useCallback(async () => {
    if (!activeLeagueId) {
      setLoading(false)
      return
    }

    setError(null)
    setLoading(true)

    const [weeksResult, futuresResult, profilesResult, settingsResult] = await Promise.all([
      supabase
        .from('weeks')
        .select('*')
        .eq('league_id', activeLeagueId)
        .order('week_number', { ascending: true }),
      supabase
        .from('futures')
        .select('*')
        .eq('league_id', activeLeagueId)
        .neq('status', 'void')
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, display_name'),
      supabase
        .from('league_settings')
        .select('*')
        .eq('league_id', activeLeagueId)
        .maybeSingle(),
    ])

    if (weeksResult.error) {
      setError(weeksResult.error.message)
      setLoading(false)
      return
    }

    if (futuresResult.error) {
      setError(futuresResult.error.message)
      setLoading(false)
      return
    }

    const profilesById = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name])
    )

    setWeeks(weeksResult.data ?? [])
    setLeagueSettings(settingsResult.data)
    setFutures(
      (futuresResult.data ?? []).map((future) => ({
        ...future,
        player_name: profilesById.get(future.player_id) ?? 'Player',
      }))
    )
    setLoading(false)
  }, [activeLeagueId])

  useEffect(() => {
    loadFutures()
  }, [loadFutures])

  const futuresWindowSettings = leagueSettings
    ? {
        futures_opens_at: leagueSettings.futures_opens_at,
        futures_closes_at: leagueSettings.futures_closes_at,
      }
    : null
  const futuresWeek = getFuturesWeek(weeks)
  const futuresLocked = futuresIsLocked(weeks, futuresWindowSettings)
  const futuresWindow = getFuturesWindow(weeks, futuresWindowSettings)
  const currentWeek = getCurrentBettingWeek(weeks)
  const allowance = futuresWeek?.allowance ?? 0

  const myFutures = useMemo(
    () => futures.filter((future) => future.player_id === userId),
    [futures, userId]
  )

  const visibleFutures = useMemo(() => {
    const rows = filter === 'mine' ? myFutures : futures
    return [...rows].sort((a, b) => {
      const aPending = (a.status ?? 'pending') === 'pending' ? 0 : 1
      const bPending = (b.status ?? 'pending') === 'pending' ? 0 : 1
      if (aPending !== bPending) return aPending - bPending
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    })
  }, [filter, futures, myFutures])

  const myStaked = sumStakes(myFutures)
  const myRemaining = remainingAllowance(allowance, myStaked)
  const pendingCount = futures.filter((future) => (future.status ?? 'pending') === 'pending').length

  if (memberships.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader />
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 text-center">
            <p className="text-zinc-300">Join a league to track futures bets.</p>
          </section>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading futures…</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader />
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button
              type="button"
              onClick={loadFutures}
              className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Retry
            </button>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <AppHeader />

        <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Season futures
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Track MVP, Super Bowl, and other season-long bets through the playoffs.
          </p>

          {activeMembership?.is_member !== false && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Your staked</p>
                <p className="mt-1 text-sm font-bold text-white">{formatMoney(myStaked)}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {futuresLocked ? 'Locked' : 'Remaining'}
                </p>
                <p className="mt-1 text-sm font-bold text-green-400">
                  {futuresLocked ? '—' : formatMoney(myRemaining)}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Pending</p>
                <p className="mt-1 text-sm font-bold text-amber-400">{pendingCount}</p>
              </div>
            </div>
          )}

          {!futuresLocked && futuresWindow?.closesAt && (
            <BettingWindowCountdown closesAt={futuresWindow.closesAt} />
          )}

          {futuresLocked && (
            <p className="mt-3 text-xs text-zinc-500">
              Futures betting is closed. Ask your commissioner to reopen the window if you still
              need to place bets.
            </p>
          )}
        </section>

        {activeLeagueId &&
          activeMembership?.is_member !== false &&
          !futuresLocked &&
          futuresWeek && (
            <BetEntrySection
              userId={userId}
              leagueId={activeLeagueId}
              currentWeek={currentWeek}
              futuresWeek={futuresWeek}
              futuresLocked={futuresLocked}
              forcedMode="futures"
              onBetPlaced={loadFutures}
            />
          )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Futures board
            </p>
            <div className="flex gap-2">
              {(['all', 'mine'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                    filter === value
                      ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                      : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
                  }`}
                >
                  {value === 'all' ? 'All players' : 'Mine'}
                </button>
              ))}
            </div>
          </div>

          {visibleFutures.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {filter === 'mine'
                ? 'You have not placed any futures bets yet.'
                : 'No futures bets in this league yet.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleFutures.map((future) => (
                <li
                  key={future.id}
                  className={`rounded-xl border px-4 py-3 ${
                    future.player_id === userId
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-zinc-800 bg-zinc-950/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-500">
                        {future.player_name}
                        {future.player_id === userId && (
                          <span className="ml-2 text-green-400">You</span>
                        )}
                      </p>
                      <p className="mt-1 truncate font-semibold">{future.selection}</p>
                      {future.category && (
                        <p className="text-xs text-zinc-500">{future.category}</p>
                      )}
                    </div>
                    <BetStatusBadge status={future.status} />
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {formatMoney(future.stake ?? 0)} at{' '}
                    {future.american_odds !== null
                      ? formatAmericanOdds(future.american_odds)
                      : '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
