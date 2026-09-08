'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { Bet, Future, LeagueSettings, Week } from '@/lib/database.types'
import { DeleteLeagueSection } from '@/components/delete-league-section'
import { FuturesWindowControls } from '@/components/futures-window-controls'
import { LeagueRosterManager } from '@/components/league-roster-manager'
import { PendingBetSettlement } from '@/components/pending-bet-settlement'
import { supabase } from '@/lib/supabase'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

const labelClassName =
  'mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400'

interface CommissionerToolsProps {
  leagueId: string
  leagueName: string
  currentUserId: string
  isPlatformAdministrator?: boolean
  onUpdated: () => void
  onLeagueDeleted?: () => void
}

type PendingBet = (Bet & { kind: 'bet'; label: string }) | (Future & { kind: 'future'; label: string })

export function CommissionerTools({
  leagueId,
  leagueName,
  currentUserId,
  isPlatformAdministrator = false,
  onUpdated,
  onLeagueDeleted,
}: CommissionerToolsProps) {
  const [settings, setSettings] = useState<LeagueSettings | null>(null)
  const [weeks, setWeeks] = useState<Week[]>([])
  const [weeklyAllowance, setWeeklyAllowance] = useState('100')
  const [futuresAllowance, setFuturesAllowance] = useState('300')
  const [playoffAllowance, setPlayoffAllowance] = useState('200')
  const [seasonYear, setSeasonYear] = useState('2026')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [pendingBets, setPendingBets] = useState<PendingBet[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [syncingWeeks, setSyncingWeeks] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadTools = useCallback(async () => {
    setLoading(true)

    const [settingsResult, betsResult, futuresResult, profilesResult, weeksResult, invitesResult, membersResult] =
      await Promise.all([
        supabase.from('league_settings').select('*').eq('league_id', leagueId).maybeSingle(),
        supabase
          .from('bets')
          .select('*')
          .eq('league_id', leagueId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('futures')
          .select('*')
          .eq('league_id', leagueId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, display_name'),
        supabase.from('weeks').select('*').eq('league_id', leagueId).order('week_number'),
        supabase
          .from('league_invites')
          .select('token')
          .eq('league_id', leagueId)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('league_members')
          .select('id', { count: 'exact', head: true })
          .eq('league_id', leagueId),
      ])

    const profilesById = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile.display_name])
    )
    const weeksById = new Map(
      (weeksResult.data ?? []).map((week) => [week.id, week])
    )

    if (settingsResult.data) {
      setSettings(settingsResult.data)
      setWeeklyAllowance(String(settingsResult.data.weekly_allowance))
      setFuturesAllowance(String(settingsResult.data.futures_allowance))
      setPlayoffAllowance(String(settingsResult.data.playoff_allowance))
      setSeasonYear(String(settingsResult.data.season_year))
    }

    const pending: PendingBet[] = []

    for (const bet of betsResult.data ?? []) {
      const displayName = profilesById.get(bet.player_id) ?? 'Player'
      const week = bet.week_id ? weeksById.get(bet.week_id) : null
      const weekLabel = week
        ? week.phase === 'playoff'
          ? `Playoff R${week.week_number - 18}`
          : `Week ${week.week_number}`
        : 'Weekly'

      pending.push({
        ...bet,
        kind: 'bet',
        label: `${displayName} · ${weekLabel}`,
      })
    }

    for (const future of futuresResult.data ?? []) {
      const displayName = profilesById.get(future.player_id) ?? 'Player'
      pending.push({
        ...future,
        kind: 'future',
        label: `${displayName} · Futures`,
      })
    }

    setPendingBets(pending)
    setMemberCount(membersResult.count ?? 0)
    setWeeks(weeksResult.data ?? [])

    const token = invitesResult.data?.[0]?.token
    if (token && typeof window !== 'undefined') {
      setInviteLink(`${window.location.origin}/join/${token}`)
    }

    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    loadTools()
  }, [loadTools])

  async function handleSaveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setSavingSettings(true)

    const payload = {
      weekly_allowance: Number.parseInt(weeklyAllowance, 10),
      futures_allowance: Number.parseInt(futuresAllowance, 10),
      playoff_allowance: Number.parseInt(playoffAllowance, 10),
      season_year: Number.parseInt(seasonYear, 10),
    }

    if (Object.values(payload).some((value) => !Number.isInteger(value) || value <= 0)) {
      setSavingSettings(false)
      setMessage({ type: 'error', text: 'Enter valid whole numbers for all settings.' })
      return
    }

    const { error } = await supabase.from('league_settings').update(payload).eq('league_id', leagueId)

    setSavingSettings(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'Budget settings saved and applied to weeks.' })
    await loadTools()
    onUpdated()
  }

  async function handleSyncWeeks() {
    setMessage(null)
    setSyncingWeeks(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setSyncingWeeks(false)
      setMessage({ type: 'error', text: 'You must be signed in.' })
      return
    }

    const response = await fetch('/api/commissioner/sync-weeks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ league_id: leagueId }),
    })

    const body = (await response.json()) as { synced?: number; error?: string }
    setSyncingWeeks(false)

    if (!response.ok) {
      setMessage({ type: 'error', text: body.error ?? 'Failed to sync weeks.' })
      return
    }

    setMessage({
      type: 'success',
      text: `Synced ${body.synced ?? 0} weeks from ESPN.`,
    })
    await loadTools()
    onUpdated()
  }

  async function settleBet(
    bet: PendingBet,
    status: 'won' | 'lost' | 'push' | 'void'
  ) {
    setMessage(null)
    setSettlingId(`${bet.kind}-${bet.id}`)

    const table = bet.kind === 'bet' ? 'bets' : 'futures'
    const { error } = await supabase.from(table).update({ status }).eq('id', bet.id)

    setSettlingId(null)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: `Marked ${bet.selection} as ${status}.` })
    await loadTools()
    onUpdated()
  }

  async function handleGenerateInvite() {
    setMessage(null)
    setGeneratingInvite(true)

    const { data, error } = await supabase.rpc('create_league_invite', {
      p_league_id: leagueId,
    })

    setGeneratingInvite(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    if (data && typeof window !== 'undefined') {
      const link = `${window.location.origin}/join/${data}`
      setInviteLink(link)
      await navigator.clipboard.writeText(link)
      setMessage({ type: 'success', text: 'Invite link copied to clipboard.' })
    }
  }

  async function handleCopyInvite() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setMessage({ type: 'success', text: 'Invite link copied.' })
  }

  if (loading) {
    return (
      <section className="mb-4 rounded-2xl border border-amber-500/20 bg-zinc-900/90 p-5">
        <p className="text-sm text-zinc-400">Loading commissioner tools…</p>
      </section>
    )
  }

  if (!settings) {
    return (
      <section className="mb-4 rounded-2xl border border-amber-500/20 bg-zinc-900/90 p-5">
        <p className="text-sm text-amber-300">
          Run `supabase/migrations/005_multi_league.sql` to enable commissioner settings.
        </p>
      </section>
    )
  }

  const pendingWeeklyBets = pendingBets.filter((bet) => bet.kind === 'bet')
  const pendingFutureBets = pendingBets.filter((bet) => bet.kind === 'future')

  return (
    <section className="mb-4 rounded-2xl border border-amber-500/20 bg-zinc-900/90 p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
          Commissioner tools
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Manage players, budgets, invites, schedule sync, and bet settlement by type.
        </p>
      </div>

      <div className="mb-5 space-y-3 border-b border-zinc-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Players & teams
        </p>
        <LeagueRosterManager
          leagueId={leagueId}
          currentUserId={currentUserId}
          isPlatformAdministrator={isPlatformAdministrator}
          onUpdated={onUpdated}
        />
      </div>

      <div className="mb-5 space-y-3 border-b border-zinc-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Invite players
        </p>
        {inviteLink ? (
          <p className="break-all rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
            {inviteLink}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">No invite link yet.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleGenerateInvite}
            disabled={generatingInvite}
            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-950 hover:bg-green-500 disabled:opacity-60"
          >
            {generatingInvite ? 'Generating…' : 'New invite link'}
          </button>
          <button
            type="button"
            onClick={handleCopyInvite}
            disabled={!inviteLink}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
          >
            Copy link
          </button>
        </div>
      </div>

      {settings && weeks.length > 0 && (
        <FuturesWindowControls
          leagueId={leagueId}
          settings={settings}
          weeks={weeks}
          onUpdated={() => {
            loadTools()
            onUpdated()
          }}
        />
      )}

      <form onSubmit={handleSaveSettings} className="space-y-4 border-b border-zinc-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Budget settings
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="weekly-allowance" className={labelClassName}>
              Weekly ($)
            </label>
            <input
              id="weekly-allowance"
              type="number"
              min={1}
              step={1}
              required
              value={weeklyAllowance}
              onChange={(event) => setWeeklyAllowance(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="futures-allowance" className={labelClassName}>
              Futures ($)
            </label>
            <input
              id="futures-allowance"
              type="number"
              min={1}
              step={1}
              required
              value={futuresAllowance}
              onChange={(event) => setFuturesAllowance(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="playoff-allowance" className={labelClassName}>
              Playoffs ($)
            </label>
            <input
              id="playoff-allowance"
              type="number"
              min={1}
              step={1}
              required
              value={playoffAllowance}
              onChange={(event) => setPlayoffAllowance(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="season-year" className={labelClassName}>
              Season year
            </label>
            <input
              id="season-year"
              type="number"
              min={2020}
              step={1}
              required
              value={seasonYear}
              onChange={(event) => setSeasonYear(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingSettings}
          className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60"
        >
          {savingSettings ? 'Saving…' : 'Save budget settings'}
        </button>
      </form>

      <div className="border-b border-zinc-800 py-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Schedule sync
        </p>
        <button
          type="button"
          onClick={handleSyncWeeks}
          disabled={syncingWeeks}
          className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-green-500 disabled:opacity-60"
        >
          {syncingWeeks ? 'Syncing…' : 'Sync weeks from ESPN'}
        </button>
        <p className="mt-2 text-xs text-zinc-500">
          Pulls the {seasonYear} NFL schedule and applies current budget settings. Weekly windows
          close at the first Saturday or Sunday kickoff (mid-week games stay open).
        </p>
      </div>

      <div className="pt-5">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Bet settlement
        </p>
        <p className="mb-4 text-sm text-zinc-500">
          Settle weekly and futures bets in separate queues.
        </p>

        <PendingBetSettlement
          title="Weekly bets"
          bets={pendingWeeklyBets}
          settlingId={settlingId}
          onSettle={settleBet}
          emptyMessage="No pending weekly bets to settle."
        />

        <PendingBetSettlement
          title="Futures bets"
          bets={pendingFutureBets}
          settlingId={settlingId}
          onSettle={settleBet}
          emptyMessage="No pending futures bets to settle."
        />
      </div>

      {message && (
        <p
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}

      {isPlatformAdministrator && onLeagueDeleted && (
        <DeleteLeagueSection
          leagueId={leagueId}
          leagueName={leagueName}
          memberCount={memberCount}
          pendingBetCount={pendingBets.length}
          onDeleted={onLeagueDeleted}
        />
      )}
    </section>
  )
}
