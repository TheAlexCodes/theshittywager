'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { LeagueSettings, Week } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import {
  formatWeekLabel,
  getCurrentBettingWeek,
  getManualBettingWeek,
  isWeekBettingOpen,
  sortedBettingWeeks,
  type LeagueBettingWindowSettings,
} from '@/lib/weeks'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

const labelClassName =
  'mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400'

interface ManualBettingWeekControlsProps {
  leagueId: string
  settings: LeagueSettings
  weeks: Week[]
  onUpdated: () => void
}

export function ManualBettingWeekControls({
  leagueId,
  settings,
  weeks,
  onUpdated,
}: ManualBettingWeekControlsProps) {
  const bettingWeeks = useMemo(() => sortedBettingWeeks(weeks), [weeks])

  const windowSettings: LeagueBettingWindowSettings = {
    futures_opens_at: settings.futures_opens_at,
    futures_closes_at: settings.futures_closes_at,
    manual_betting_week_id: settings.manual_betting_week_id,
  }

  const manualWeek = getManualBettingWeek(weeks, windowSettings)
  const scheduleWeek = getCurrentBettingWeek(weeks, {
    ...windowSettings,
    manual_betting_week_id: null,
  })

  const [selectedWeekId, setSelectedWeekId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (manualWeek) {
      setSelectedWeekId(String(manualWeek.id))
      return
    }
    if (scheduleWeek) {
      setSelectedWeekId(String(scheduleWeek.id))
      return
    }
    const latest = bettingWeeks[bettingWeeks.length - 1]
    setSelectedWeekId(latest ? String(latest.id) : '')
  }, [bettingWeeks, manualWeek, scheduleWeek, leagueId])

  async function updateManualWeek(weekId: number | null) {
    setMessage(null)
    setSaving(true)

    const { error } = await supabase
      .from('league_settings')
      .update({ manual_betting_week_id: weekId })
      .eq('league_id', leagueId)

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    if (weekId === null) {
      setMessage({ type: 'success', text: 'Weekly betting follows the NFL schedule again.' })
    } else {
      const week = bettingWeeks.find((item) => item.id === weekId)
      setMessage({
        type: 'success',
        text: week
          ? `${formatWeekLabel(week)} is now the only open weekly board.`
          : 'Weekly board updated.',
      })
    }

    onUpdated()
  }

  async function handleOpenSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const weekId = Number.parseInt(selectedWeekId, 10)
    if (!Number.isInteger(weekId)) {
      setMessage({ type: 'error', text: 'Select a week.' })
      return
    }
    await updateManualWeek(weekId)
  }

  async function handleUseSchedule() {
    await updateManualWeek(null)
  }

  if (bettingWeeks.length === 0) {
    return null
  }

  return (
    <div className="space-y-4 border-b border-zinc-800 py-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Open weekly board
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Override the schedule to open a specific week, including one that already closed. Only
          that week accepts new bets until you return to the schedule.
        </p>
      </div>

      <p className="text-sm text-zinc-400">
        Status:{' '}
        {manualWeek ? (
          <span className="font-semibold text-amber-300">
            Manual · {formatWeekLabel(manualWeek)}
          </span>
        ) : scheduleWeek ? (
          <span className="font-semibold text-zinc-200">
            Schedule · {formatWeekLabel(scheduleWeek)}
          </span>
        ) : (
          <span className="font-semibold text-zinc-200">No weekly board open</span>
        )}
      </p>

      <form onSubmit={handleOpenSelected} className="space-y-3">
        <div>
          <label htmlFor="manual-week" className={labelClassName}>
            Week to open
          </label>
          <select
            id="manual-week"
            value={selectedWeekId}
            onChange={(event) => setSelectedWeekId(event.target.value)}
            className={inputClassName}
          >
            {bettingWeeks.map((week) => (
              <option key={week.id} value={week.id}>
                {formatWeekLabel(week)}
                {isWeekBettingOpen(week, weeks, {
                  ...windowSettings,
                  manual_betting_week_id: null,
                })
                  ? ' · Open on schedule'
                  : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="submit"
            disabled={saving || !selectedWeekId}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Open this week'}
          </button>
          <button
            type="button"
            onClick={handleUseSchedule}
            disabled={saving || manualWeek === null}
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 disabled:opacity-60"
          >
            Use NFL schedule
          </button>
        </div>
      </form>

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
    </div>
  )
}