'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import type { AppliedBetScan, ScannedBetSlip } from '@/lib/bet-slip-scan'
import { BetSlipScanner } from '@/components/bet-slip-scanner'
import { BetStatusBadge } from '@/components/bet-status-badge'
import type { Bet, Future, Week } from '@/lib/database.types'
import {
  americanOddsPayout,
  formatAmericanOdds,
  formatMoney,
  parseAmericanOdds,
  remainingAllowance,
  sumStakes,
} from '@/lib/odds'
import { supabase } from '@/lib/supabase'
import { formatWeekLabel } from '@/lib/weeks'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

const labelClassName =
  'mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400'

interface BetEntrySectionProps {
  userId: string
  leagueId: string
  currentWeek: Week | null
  futuresWeek: Week | null
  futuresLocked: boolean
  onBetPlaced: () => void
}

type EntryMode = 'weekly' | 'futures'

export function BetEntrySection({
  userId,
  leagueId,
  currentWeek,
  futuresWeek,
  futuresLocked,
  onBetPlaced,
}: BetEntrySectionProps) {
  const mode: EntryMode | null = currentWeek
    ? 'weekly'
    : !futuresLocked && futuresWeek
      ? 'futures'
      : null

  const [weeklyBets, setWeeklyBets] = useState<Bet[]>([])
  const [futureBets, setFutureBets] = useState<Future[]>([])
  const [loadingBets, setLoadingBets] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [betType, setBetType] = useState('')
  const [category, setCategory] = useState('')
  const [selection, setSelection] = useState('')
  const [stake, setStake] = useState('')
  const [oddsInput, setOddsInput] = useState('')

  const loadBets = useCallback(async () => {
    setLoadingBets(true)

    if (currentWeek) {
      const { data } = await supabase
        .from('bets')
        .select('*')
        .eq('league_id', leagueId)
        .eq('player_id', userId)
        .eq('week_id', currentWeek.id)
        .neq('status', 'void')
        .order('created_at', { ascending: false })

      setWeeklyBets(data ?? [])
    } else {
      setWeeklyBets([])
    }

    if (!futuresLocked) {
      const { data } = await supabase
        .from('futures')
        .select('*')
        .eq('league_id', leagueId)
        .eq('player_id', userId)
        .neq('status', 'void')
        .order('created_at', { ascending: false })

      setFutureBets(data ?? [])
    } else {
      setFutureBets([])
    }

    setLoadingBets(false)
  }, [currentWeek, futuresLocked, leagueId, userId])

  useEffect(() => {
    loadBets()
  }, [loadBets])

  if (!mode) {
    return null
  }

  const allowance =
    mode === 'weekly' ? (currentWeek?.allowance ?? 0) : (futuresWeek?.allowance ?? 0)
  const staked = mode === 'weekly' ? sumStakes(weeklyBets) : sumStakes(futureBets)
  const left = remainingAllowance(allowance, staked)
  const parsedOdds = parseAmericanOdds(oddsInput)
  const parsedStake = Number.parseInt(stake, 10)
  const potentialPayout =
    parsedOdds && parsedStake > 0 ? americanOddsPayout(parsedStake, parsedOdds) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const odds = parseAmericanOdds(oddsInput)
    const stakeAmount = Number.parseInt(stake, 10)

    if (!selection.trim()) {
      setMessage({ type: 'error', text: 'Enter a selection.' })
      return
    }

    if (!Number.isInteger(stakeAmount) || stakeAmount <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid whole-dollar stake.' })
      return
    }

    if (!odds) {
      setMessage({ type: 'error', text: 'Enter valid American odds (e.g. -110 or +200).' })
      return
    }

    if (stakeAmount > left) {
      setMessage({
        type: 'error',
        text: `Stake exceeds remaining allowance of ${formatMoney(left)}.`,
      })
      return
    }

    setSubmitting(true)

    if (mode === 'weekly' && currentWeek) {
      const { error } = await supabase.from('bets').insert({
        league_id: leagueId,
        player_id: userId,
        week_id: currentWeek.id,
        bet_type: betType.trim() || null,
        selection: selection.trim(),
        stake: stakeAmount,
        american_odds: odds,
      })

      setSubmitting(false)

      if (error) {
        setMessage({ type: 'error', text: error.message })
        return
      }
    } else {
      const { error } = await supabase.from('futures').insert({
        league_id: leagueId,
        player_id: userId,
        category: category.trim() || null,
        selection: selection.trim(),
        stake: stakeAmount,
        american_odds: odds,
      })

      setSubmitting(false)

      if (error) {
        setMessage({ type: 'error', text: error.message })
        return
      }
    }

    setBetType('')
    setCategory('')
    setSelection('')
    setStake('')
    setOddsInput('')
    setMessage({ type: 'success', text: 'Bet placed.' })
    await loadBets()
    onBetPlaced()
  }

  const activeBets = mode === 'weekly' ? weeklyBets : futureBets

  function handleScanApply(values: AppliedBetScan, scan: ScannedBetSlip) {
    setBetType(values.betType)
    setCategory(values.category)
    setSelection(values.selection)
    setStake(values.stake)
    setOddsInput(values.oddsInput)
    setMessage({
      type: 'success',
      text:
        scan.confidence === 'low'
          ? 'Slip scanned — please double-check the values before placing.'
          : 'Slip scanned — review the form and place your bet.',
    })
  }

  return (
    <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Place a bet
          </p>
          <p className="mt-1 text-lg font-bold">
            {mode === 'weekly' && currentWeek
              ? formatWeekLabel(currentWeek)
              : 'Futures'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Remaining</p>
          <p className="text-lg font-bold text-green-400">{formatMoney(left)}</p>
          <p className="text-[10px] text-zinc-500">
            {formatMoney(staked)} / {formatMoney(allowance)} staked
          </p>
        </div>
      </div>

      <div className="mb-4">
        <BetSlipScanner
          mode={mode}
          disabled={left <= 0}
          onApply={handleScanApply}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'weekly' ? (
          <div>
            <label htmlFor="bet-type" className={labelClassName}>
              Bet type
            </label>
            <input
              id="bet-type"
              type="text"
              placeholder="Spread, Moneyline, Total, Prop"
              value={betType}
              onChange={(event) => setBetType(event.target.value)}
              className={inputClassName}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="category" className={labelClassName}>
              Category
            </label>
            <input
              id="category"
              type="text"
              placeholder="MVP, Coach of the Year, etc."
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={inputClassName}
            />
          </div>
        )}

        <div>
          <label htmlFor="selection" className={labelClassName}>
            Selection
          </label>
          <input
            id="selection"
            type="text"
            required
            placeholder="Chiefs -3.5, Mahomes MVP, etc."
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
            className={inputClassName}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="stake" className={labelClassName}>
              Stake ($)
            </label>
            <input
              id="stake"
              type="number"
              required
              min={1}
              step={1}
              placeholder="50"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="odds" className={labelClassName}>
              American odds
            </label>
            <input
              id="odds"
              type="text"
              required
              placeholder="-110 or +200"
              value={oddsInput}
              onChange={(event) => setOddsInput(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        {potentialPayout !== null && (
          <p className="text-sm text-zinc-400">
            Potential payout:{' '}
            <span className="font-semibold text-white">{formatMoney(potentialPayout)}</span>
            {parsedOdds !== null && (
              <span className="text-zinc-500"> ({formatAmericanOdds(parsedOdds)})</span>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || left <= 0}
          className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Placing…' : left <= 0 ? 'Allowance used' : 'Place bet'}
        </button>
      </form>

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

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your bets this period
        </p>

        {loadingBets ? (
          <p className="text-sm text-zinc-500">Loading bets…</p>
        ) : activeBets.length === 0 ? (
          <p className="text-sm text-zinc-500">No bets placed yet.</p>
        ) : (
          <ul className="space-y-2">
            {activeBets.map((bet) => {
              const isWeekly = 'week_id' in bet
              const meta = isWeekly
                ? (bet as Bet).bet_type
                : (bet as Future).category
              const odds = bet.american_odds

              return (
                <li
                  key={`${isWeekly ? 'bet' : 'future'}-${bet.id}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{bet.selection}</p>
                      {meta && <p className="text-xs text-zinc-500">{meta}</p>}
                    </div>
                    <BetStatusBadge status={bet.status} />
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {formatMoney(bet.stake ?? 0)} at{' '}
                    {odds !== null ? formatAmericanOdds(odds) : '—'}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
