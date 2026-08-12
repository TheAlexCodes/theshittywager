'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { BetEntrySection } from '@/components/bet-entry-section'
import {
  hasSeenRulesIntro,
  LeagueRulesDialog,
} from '@/components/league-rules-dialog'
import type { Profile, Standing, Week } from '@/lib/database.types'
import { useLeague } from '@/lib/league-context'
import { loadProfile } from '@/lib/profile'
import { formatMoney } from '@/lib/odds'
import { supabase } from '@/lib/supabase'
import {
  formatPhaseLabel,
  formatWeekLabel,
  futuresIsLocked,
  getCurrentBettingWeek,
  getFuturesWeek,
} from '@/lib/weeks'

interface DashboardProps {
  userId: string
}

export function Dashboard({ userId }: DashboardProps) {
  const {
    activeLeagueId,
    activeMembership,
    isCommissioner,
    canManageActiveLeague,
    isAdministrator,
    loading: leagueLoading,
    memberships,
  } = useLeague()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [welcomeOpen, setWelcomeOpen] = useState(false)

  useEffect(() => {
    if (!hasSeenRulesIntro()) {
      setWelcomeOpen(true)
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    if (!activeLeagueId) {
      setLoading(false)
      return
    }

    setError(null)

    const [profileResult, standingsResult, weeksResult] = await Promise.all([
      loadProfile(),
      supabase
        .from('standings')
        .select('*')
        .eq('league_id', activeLeagueId)
        .order('standing_rank', { ascending: true }),
      supabase
        .from('weeks')
        .select('*')
        .eq('league_id', activeLeagueId)
        .order('week_number', { ascending: true }),
    ])

    if (profileResult.error) {
      setError(profileResult.error)
      setLoading(false)
      return
    }

    if (standingsResult.error) {
      setError(standingsResult.error.message)
      setLoading(false)
      return
    }

    if (weeksResult.error) {
      setError(weeksResult.error.message)
      setLoading(false)
      return
    }

    setProfile(profileResult.profile)
    setStandings(standingsResult.data)
    setWeeks(weeksResult.data)
    setLoading(false)
  }, [activeLeagueId, userId])

  useEffect(() => {
    if (!leagueLoading) {
      setLoading(true)
      loadDashboard()
    }
  }, [loadDashboard, leagueLoading])

  const currentWeek = getCurrentBettingWeek(weeks)
  const futuresWeek = getFuturesWeek(weeks)
  const futuresLocked = futuresIsLocked(weeks)
  const leader = standings[0]
  const bankroll = activeMembership?.bankroll ?? 0

  if (leagueLoading || loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading dashboard…</p>
      </main>
    )
  }

  if (memberships.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader />
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 text-center">
            <p className="text-zinc-300">You are not in a league yet.</p>
            <Link
              href="/leagues/new"
              className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-zinc-950"
            >
              Create a league
            </Link>
          </section>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              loadDashboard()
            }}
            className="mt-4 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <AppHeader />

        {profile && activeLeagueId && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-[0_0_40px_rgba(34,197,94,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Welcome back
                </p>
                <p className="mt-1 text-xl font-bold">{profile.display_name}</p>
              </div>
              <Link
                href="/profile"
                className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Edit team
              </Link>
            </div>
            <p className="mt-3 text-3xl font-black text-green-400">{formatMoney(bankroll)}</p>
            <p className="mt-1 text-xs text-zinc-500">Play-money bankroll</p>
            {isAdministrator ? (
              <span className="mt-3 inline-block rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                Administrator
              </span>
            ) : isCommissioner ? (
              <span className="mt-3 inline-block rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
                Commissioner
              </span>
            ) : null}
          </section>
        )}

        <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Current period
          </p>
          {currentWeek ? (
            <div className="mt-2">
              <p className="text-lg font-bold">{formatWeekLabel(currentWeek)}</p>
              <p className="text-sm text-zinc-400">{formatPhaseLabel(currentWeek.phase)}</p>
              <p className="mt-2 text-sm text-zinc-300">
                Weekly allowance:{' '}
                <span className="font-semibold text-white">
                  {formatMoney(currentWeek.allowance)}
                </span>
              </p>
            </div>
          ) : !futuresLocked && futuresWeek ? (
            <div className="mt-2">
              <p className="text-lg font-bold">Futures</p>
              <p className="text-sm text-zinc-400">Pre-season window open</p>
              <p className="mt-2 text-sm text-zinc-300">
                Futures allowance:{' '}
                <span className="font-semibold text-white">
                  {formatMoney(futuresWeek.allowance)}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">No open betting period configured yet.</p>
          )}
        </section>

        {activeLeagueId && activeMembership?.is_member !== false && (
          <BetEntrySection
            userId={userId}
            leagueId={activeLeagueId}
            currentWeek={currentWeek}
            futuresWeek={futuresWeek}
            futuresLocked={futuresLocked}
            onBetPlaced={loadDashboard}
          />
        )}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Standings
              </p>
              {leader && (
                <p className="mt-1 text-sm text-zinc-500">
                  Leader: <span className="text-zinc-300">{leader.display_name}</span>
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-500">{standings.length} players</p>
          </div>

          {standings.length === 0 ? (
            <p className="text-sm text-zinc-400">No players in this league yet.</p>
          ) : (
            <ul className="space-y-2">
              {standings.map((entry) => {
                const isCurrentUser = entry.player_id === userId
                const isLeader = entry.standing_rank === 1

                return (
                  <li
                    key={entry.player_id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      isCurrentUser
                        ? 'border-green-500/40 bg-green-500/10'
                        : 'border-zinc-800 bg-zinc-950/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isLeader
                            ? 'bg-green-600 text-zinc-950'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {entry.standing_rank}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {entry.display_name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs font-normal text-green-400">You</span>
                          )}
                        </p>
                        {entry.is_commissioner && (
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                            Commissioner
                          </p>
                        )}
                      </div>
                    </div>
                    <p
                      className={`shrink-0 pl-3 text-sm font-bold ${
                        entry.bankroll >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {formatMoney(entry.bankroll)}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <LeagueRulesDialog
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        variant="welcome"
      />
    </main>
  )
}
