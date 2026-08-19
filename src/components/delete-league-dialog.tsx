'use client'

import { FormEvent, useEffect, useState } from 'react'

interface DeleteLeagueDialogProps {
  open: boolean
  leagueName: string
  memberCount: number
  pendingBetCount: number
  deleting: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteLeagueDialog({
  open,
  leagueName,
  memberCount,
  pendingBetCount,
  deleting,
  error,
  onClose,
  onConfirm,
}: DeleteLeagueDialogProps) {
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (!open) {
      setConfirmation('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, deleting, onClose])

  if (!open) return null

  const nameMatches = confirmation.trim() === leagueName

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nameMatches || deleting) return
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close delete league dialog"
        className="absolute inset-0"
        disabled={deleting}
        onClick={onClose}
      />

      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-league-title"
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-red-500/30 bg-zinc-900 p-5 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
          Danger zone
        </p>
        <h2 id="delete-league-title" className="mt-1 text-xl font-black uppercase tracking-tight">
          Delete league
        </h2>
        <p className="mt-3 text-sm text-zinc-400">
          This permanently removes <span className="font-semibold text-white">{leagueName}</span>,
          all players, bets, weeks, and settings. This cannot be undone.
        </p>

        <ul className="mt-3 space-y-1 text-sm text-zinc-500">
          <li>{memberCount} player{memberCount === 1 ? '' : 's'}</li>
          <li>{pendingBetCount} pending bet{pendingBetCount === 1 ? '' : 's'}</li>
        </ul>

        <div className="mt-4">
          <label htmlFor="delete-league-confirm" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Type the league name to confirm
          </label>
          <input
            id="delete-league-confirm"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={leagueName}
            disabled={deleting}
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:opacity-60"
          />
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!nameMatches || deleting}
            className="rounded-lg bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-500 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete league'}
          </button>
        </div>
      </form>
    </div>
  )
}
