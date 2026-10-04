'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Week } from '@/lib/database.types'
import { formatWindowCloseDate } from '@/lib/time'
import {
  extendWeeklyCloseAt,
  formatWeekLabel,
  getCurrentBettingWeek,
  getEffectiveWeeklyCloseAt,
  isWeekBettingOpen,
} from '@/lib/weeks'
import { supabase } from '@/lib/supabase'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

const labelClassName =
  'mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400'

interface WeeklyWindowExtensionProps {
  leagueId: string
  weeks: Week[]
  onUpdated: () => void
}

export function WeeklyWindowExtension({
  leagueId,
  weeks,
  onUpdated,
}: WeeklyWindowExtensionProps) {
  const bettingWeeks = useMemo(
    () =>
      [...weeks]
        .filter((week) => week.phase !== 'futures')
        .sort((a, b) => a.week_number - b.week_number),
    [weeks]
  )

  const defaultWeekId = useMemo(() => {
    const current = getCurrentBettingWeek(weeks)
    if (current) return String(current.id)

    const latestOpened = [...bettingWeeks]
      .filter((week) => new Date(week.reveal_at) <= new Date())
      .sort((a, b) => b.week_number - a.week_number)[0]

    return latestOpened ? String(latestOpened.id) : ''
  }, [bettingWeeks, weeks])

  const [selectedWeekId, setSelectedWeekId] = useState('')
  const [extendHours, setExtendHours] = useState('2')
  const [extending, setExtending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setSelectedWeekId(defaultWeekId)
  }, [defaultWeekId, leagueId])

  const selectedWeek = bettingWeeks.find((week) => String(week.id) === selectedWeekId) ?? null
  const effectiveClose = selectedWeek ? getEffectiveWeeklyCloseAt(weeks, selectedWeek) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    if (!selectedWeek) {
      setMessage({ type: 'error', text: 'Select a week to extend.' })
      return
    }

    const hours = Number.parseInt(extendHours, 10)
    if (!Number.isInteger(hours) || hours <= 0) {
      setMessage({ type: 'error', text: 'Enter a whole number of hours greater than zero.' })
      return
    }

    const newCloseAt = extendWeeklyCloseAt(weeks, selectedWeek, hours)

    setExtending(true)
    const { error } = await supabase
      .from('weeks')
      .update({ betting_closes_at: newCloseAt.toISOString() })
      .eq('id', selectedWeek.id)
      .eq('league_id', leagueId)

    setExtending(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({
      type: 'success',
      text: `${formatWeekLabel(selectedWeek)} now closes ${formatWindowCloseDate(newCloseAt)}.`,
    })
    onUpdated()
  }

  if (bettingWeeks.length === 0) {
    return null
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-b border-zinc-800 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Extend weekly window
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Add extra time before a week&apos;s betting closes. Useful if players need more time
          after a Thursday game or a tight deadline.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="extend-week" className={labelClassName}>
            Week
          </label>
          <select
            id="extend-week"
            value={selectedWeekId}
            onChange={(event) => setSelectedWeekId(event.target.value)}
            className={inputClassName}
          >
            {bettingWeeks.map((week) => (
              <option key={week.id} value={week.id}>
                {formatWeekLabel(week)}
                {isWeekBettingOpen(week) ? ' · Open' : ' · Closed'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="extend-hours" className={labelClassName}>
            Extend by (hours)
          </label>
          <input
            id="extend-hours"
            type="number"
            min={1}
            step={1}
            required
            value={extendHours}
            onChange={(event) => setExtendHours(event.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      {selectedWeek && (
        <p className="text-sm text-zinc-400">
          Current close:{' '}
          <span className="font-semibold text-zinc-200">
            {effectiveClose ? formatWindowCloseDate(effectiveClose) : 'Not set — sync from ESPN'}
          </span>
        </p>
      )}

      <button
        type="submit"
        disabled={extending || !selectedWeek}
        className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60"
      >
        {extending ? 'Extending…' : 'Extend betting window'}
      </button>

      {message && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  )
}
