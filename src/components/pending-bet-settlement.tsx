'use client'

import type { Bet, Future } from '@/lib/database.types'
import { formatAmericanOdds, formatMoney } from '@/lib/odds'

type PendingBet = (Bet & { kind: 'bet'; label: string }) | (Future & { kind: 'future'; label: string })

interface PendingBetSettlementProps {
  title: string
  bets: PendingBet[]
  settlingId: string | null
  onSettle: (bet: PendingBet, status: 'won' | 'lost' | 'push' | 'void') => void
  emptyMessage: string
}

export function PendingBetSettlement({
  title,
  bets,
  settlingId,
  onSettle,
  emptyMessage,
}: PendingBetSettlementProps) {
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
            const settling = settlingId === `${bet.kind}-${bet.id}`
            const meta =
              bet.kind === 'bet'
                ? (bet as Bet & { kind: 'bet' }).bet_type
                : (bet as Future & { kind: 'future' }).category

            return (
              <li
                key={`${bet.kind}-${bet.id}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
              >
                <p className="text-xs text-zinc-500">{bet.label}</p>
                <p className="mt-1 font-semibold">{bet.selection}</p>
                {meta && <p className="text-xs text-zinc-500">{meta}</p>}
                <p className="mt-2 text-sm text-zinc-400">
                  {formatMoney(bet.stake ?? 0)} at{' '}
                  {bet.american_odds !== null
                    ? formatAmericanOdds(bet.american_odds)
                    : '—'}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['won', 'lost', 'push', 'void'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={settling}
                      onClick={() => onSettle(bet, status)}
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
