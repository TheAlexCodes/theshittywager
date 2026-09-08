'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { LeagueSettings, Week } from '@/lib/database.types'
import { getFuturesWindow, type FuturesWindowSettings } from '@/lib/futures-window'
import { formatWindowCloseDate, parseDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/time'
import { supabase } from '@/lib/supabase'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

const labelClassName =
  'mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400'

interface FuturesWindowControlsProps {
  leagueId: string
  settings: LeagueSettings
  weeks: Week[]
  onUpdated: () => void
}

export function FuturesWindowControls({
  leagueId,
  settings,
  weeks,
  onUpdated,
}: FuturesWindowControlsProps) {
  const [opensInput, setOpensInput] = useState('')
  const [closesInput, setClosesInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const windowSettings: FuturesWindowSettings = {
    futures_opens_at: settings.futures_opens_at,
    futures_closes_at: settings.futures_closes_at,
  }
  const window = getFuturesWindow(weeks, windowSettings)

  useEffect(() => {
    const scheduleWindow = getFuturesWindow(weeks, windowSettings)
    setOpensInput(
      settings.futures_opens_at
        ? toDatetimeLocalValue(new Date(settings.futures_opens_at))
        : scheduleWindow
          ? toDatetimeLocalValue(scheduleWindow.opensAt)
          : ''
    )
    setClosesInput(
      settings.futures_closes_at
        ? toDatetimeLocalValue(new Date(settings.futures_closes_at))
        : scheduleWindow?.closesAt
          ? toDatetimeLocalValue(scheduleWindow.closesAt)
          : ''
    )
  }, [settings.futures_opens_at, settings.futures_closes_at, weeks])

  async function saveWindow(payload: {
    futures_opens_at: string | null
    futures_closes_at: string | null
  }) {
    setSaving(true)
    setMessage(null)

    const { error } = await supabase
      .from('league_settings')
      .update(payload)
      .eq('league_id', leagueId)

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'Futures window updated.' })
    onUpdated()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const opensAt = parseDatetimeLocalValue(opensInput)
    const closesAt = parseDatetimeLocalValue(closesInput)

    if (!opensAt) {
      setMessage({ type: 'error', text: 'Choose when the futures window opens.' })
      return
    }

    if (closesAt && closesAt <= opensAt) {
      setMessage({ type: 'error', text: 'Close time must be after open time.' })
      return
    }

    await saveWindow({
      futures_opens_at: opensAt.toISOString(),
      futures_closes_at: closesAt?.toISOString() ?? null,
    })
  }

  async function handleClearOverride() {
    await saveWindow({
      futures_opens_at: null,
      futures_closes_at: null,
    })
  }

  async function handleReopenWeek() {
    const opensAt = new Date()
    const closesAt = new Date(opensAt.getTime() + 7 * 24 * 60 * 60 * 1000)
    await saveWindow({
      futures_opens_at: opensAt.toISOString(),
      futures_closes_at: closesAt.toISOString(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border-b border-zinc-800 pb-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Futures window
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Control when players can place season-long futures bets. Re-open the window if someone
          missed the deadline.
        </p>
        {window && (
          <p className="mt-2 text-sm text-zinc-300">
            Status:{' '}
            <span className={window.isOpen ? 'text-green-400' : 'text-amber-400'}>
              {window.isOpen ? 'Open' : 'Closed'}
            </span>
            {!window.isOpen && (
              <span className="text-zinc-500">
                {' '}
                · Opens {formatWindowCloseDate(window.opensAt)}
              </span>
            )}
            {window.closesAt && (
              <span className="text-zinc-500">
                {' '}
                · Closes {formatWindowCloseDate(window.closesAt)}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="futures-opens-at" className={labelClassName}>
            Opens at
          </label>
          <input
            id="futures-opens-at"
            type="datetime-local"
            required
            value={opensInput}
            onChange={(event) => setOpensInput(event.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="futures-closes-at" className={labelClassName}>
            Closes at
          </label>
          <input
            id="futures-closes-at"
            type="datetime-local"
            value={closesInput}
            onChange={(event) => setClosesInput(event.target.value)}
            className={inputClassName}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-950 hover:bg-green-500 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save window'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleReopenWeek}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
        >
          Reopen 7 days
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={handleClearOverride}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
        >
          Use ESPN schedule
        </button>
      </div>

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
