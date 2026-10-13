'use client'

import { useEffect, useState } from 'react'
import type { Bet, Future } from '@/lib/database.types'
import {
  americanOddsPayout,
  formatAmericanOdds,
  formatMoney,
  parseAmericanOdds,
} from '@/lib/odds'

type PendingBet = (Bet & { kind: 'bet'; label: string }) | (Future & { kind: 'future'; label: string })

interface PendingBetSettlementProps {
  title: string
  bets: PendingBet[]
  settlingId: string | null
  onSettle: (
    bet: PendingBet,
    status: 'won' | 'lost' | 'push' | 'void',
    americanOdds: number | null
  ) => void
  emptyMessage: string
}

function betKey(bet: PendingBet): string {
  return `${bet.kind}-${bet.id}`
}

function defaultOddsInput(bet: PendingBet): string {
  if (bet.american_odds === null) return ''
  return bet.american_odds > 0 ? `+${bet.american_odds}` : String(bet.american_odds)
}

export function PendingBetSettlement({
  title,
  bets,
  settlingId,
  onSettle,
  emptyMessage,
}: PendingBetSettlementProps) {
  const [oddsInputs, setOddsInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    setOddsInputs((previous) => {
      const next = { ...previous }
      for (const bet of bets) {
        const key = betKey(bet)
        if (next[key] === undefined) {
          next[key] = defaultOddsInput(bet)
        }
      }
      return next
    })
  }, [bets])

  return (
    <div className="border-b border-zinc-800 py-5 last:border-b-0">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {title} ({bets.length})
      </p>

      {bets.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {bets.map((bet) => {
            const key = betKey(bet)
            const settling = settlingId === key
            const meta =
              bet.kind === 'bet'
                ? (bet as Bet & { kind: 'bet' }).bet_type
                : (bet as Future & { kind: 'future' }).category
            const oddsInput = oddsInputs[key] ?? defaultOddsInput(bet)
            const parsedOdds = parseAmericanOdds(oddsInput)
            const stake = bet.stake ?? 0
            const winPayout =
              parsedOdds !== null && stake > 0
                ? americanOddsPayout(stake, parsedOdds)
                : null

            return (
              <li
                key={key}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <p className="text-xs text-zinc-500">{bet.label}</p>
                <p className="mt-1 font-semibold">{bet.selection}</p>
                {meta && <p className="text-xs text-zinc-500">{meta}</p>}
                <p className="mt-2 text-sm text-zinc-400">
                  Stake {formatMoney(stake)}
                  {bet.american_odds !== null && (
                    <>
                      {' '}
                      · posted at {formatAmericanOdds(bet.american_odds)}
                    </>
                  )}
                </p>

                <div className="mt-3">
                  <label
                    htmlFor={`odds-${key}`}
                    className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400"
                  >
                    American odds (for settlement)
                  </label>
                  <input
                    id={`odds-${key}`}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    value={oddsInput}
                    onChange={(event) =>
                      setOddsInputs((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder="e.g. -110 or +350"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Adjust if a leg pushed or the book paid at different odds, then mark won.
                  </p>
                  {winPayout !== null && (
                    <p className="mt-1 text-xs text-green-400/90">
                      If won at these odds: {formatMoney(winPayout)} total return
                    </p>
                  )}
                  {oddsInput.trim() !== '' && parsedOdds === null && (
                    <p className="mt-1 text-xs text-amber-400">Enter valid American odds before marking won.</p>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['won', 'lost', 'push', 'void'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={settling}
                      onClick={() => onSettle(bet, status, parsedOdds)}
                      className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide transition disabled:opacity-60 ${
                        status === 'won'
                          ? 'bg-green-600 text-zinc-950 hover:bg-green-500'
                          : status === 'lost'
                            ? 'bg-red-600/80 text-white hover:bg-red-600'
                            : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
