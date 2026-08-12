'use client'

import { useEffect } from 'react'
import { LEAGUE_RULES, RULES_STORAGE_KEY } from '@/lib/league-rules'

interface LeagueRulesDialogProps {
  open: boolean
  onClose: () => void
  variant?: 'welcome' | 'info'
}

export function markRulesIntroSeen() {
  if (typeof window !== 'undefined') {
    localStorage.setItem(RULES_STORAGE_KEY, '1')
  }
}

export function hasSeenRulesIntro(): boolean {
  if (typeof window === 'undefined') {
    return true
  }

  return localStorage.getItem(RULES_STORAGE_KEY) === '1'
}

export function LeagueRulesDialog({
  open,
  onClose,
  variant = 'info',
}: LeagueRulesDialogProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  function handleClose() {
    if (variant === 'welcome') {
      markRulesIntroSeen()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close rules"
        className="absolute inset-0"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-rules-title"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-500">
              {variant === 'welcome' ? 'Welcome' : 'League info'}
            </p>
            <h2 id="league-rules-title" className="mt-1 text-xl font-black uppercase tracking-tight">
              How it works
            </h2>
            {variant === 'welcome' && (
              <p className="mt-2 text-sm text-zinc-400">
                Quick overview before you jump in.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="space-y-4">
          {LEAGUE_RULES.map((section) => (
            <section key={section.title} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
              <h3 className="text-sm font-bold text-white">{section.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{section.body}</p>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="mt-5 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 hover:bg-green-500"
        >
          {variant === 'welcome' ? 'Got it — let\'s go' : 'Close'}
        </button>
      </div>
    </div>
  )
}
