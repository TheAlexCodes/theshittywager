'use client'

import { useRef, useState } from 'react'
import type { AppliedBetScan, ScannedBetSlip } from '@/lib/bet-slip-scan'
import { applyScanToForm } from '@/lib/bet-slip-scan'
import { formatAmericanOdds, formatMoney } from '@/lib/odds'
import { supabase } from '@/lib/supabase'

interface BetSlipScannerProps {
  mode: 'weekly' | 'futures'
  disabled?: boolean
  onApply: (values: AppliedBetScan, scan: ScannedBetSlip) => void
}

export function BetSlipScanner({ mode, disabled = false, onApply }: BetSlipScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState<ScannedBetSlip | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setScanning(true)
    setError(null)
    setPreview(null)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      setScanning(false)
      setError('You must be signed in to scan a bet slip.')
      return
    }

    const formData = new FormData()
    formData.append('image', file)
    formData.append('mode', mode)

    try {
      const response = await fetch('/api/bets/scan', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      const body = (await response.json()) as { scan?: ScannedBetSlip; error?: string }

      if (!response.ok) {
        setError(body.error ?? 'Failed to scan bet slip.')
        return
      }

      if (body.scan) {
        setPreview(body.scan)
      }
    } catch {
      setError('Failed to scan bet slip.')
    } finally {
      setScanning(false)
    }
  }

  function handleApply() {
    if (!preview) return
    onApply(applyScanToForm(preview, mode), preview)
    setPreview(null)
    setError(null)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Scan bet slip
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Take a photo or upload a screenshot from DraftKings, FanDuel, etc.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || scanning}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-green-400 hover:bg-green-500/20 disabled:opacity-60"
        >
          {scanning ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {preview && (
        <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-white">{preview.selection}</p>
              {(preview.bet_type || preview.category) && (
                <p className="mt-1 text-xs text-zinc-400">
                  {preview.bet_type ?? preview.category}
                </p>
              )}
              <p className="mt-2 text-sm text-zinc-300">
                {preview.stake !== null ? formatMoney(preview.stake) : 'Stake not detected'}
                {preview.american_odds !== null && (
                  <span className="text-zinc-500">
                    {' '}
                    at {formatAmericanOdds(preview.american_odds)}
                  </span>
                )}
              </p>
              {preview.notes && (
                <p className="mt-2 text-xs text-zinc-500">{preview.notes}</p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                preview.confidence === 'high'
                  ? 'bg-green-500/10 text-green-400'
                  : preview.confidence === 'medium'
                    ? 'bg-yellow-500/10 text-yellow-400'
                    : 'bg-red-500/10 text-red-400'
              }`}
            >
              {preview.confidence}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-950 hover:bg-green-500"
            >
              Use these values
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 hover:border-zinc-500"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
