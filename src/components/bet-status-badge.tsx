import type { BetStatus } from '@/lib/database.types'

interface BetStatusBadgeProps {
  status: BetStatus | null | undefined
}

export function BetStatusBadge({ status }: BetStatusBadgeProps) {
  const value = status ?? 'pending'

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        value === 'pending'
          ? 'bg-yellow-500/10 text-yellow-400'
          : value === 'won'
            ? 'bg-green-500/10 text-green-400'
            : value === 'lost'
              ? 'bg-red-500/10 text-red-400'
              : 'bg-zinc-800 text-zinc-400'
      }`}
    >
      {value}
    </span>
  )
}
