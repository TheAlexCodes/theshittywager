'use client'

import { useEffect, useState } from 'react'
import { formatCountdown, formatWindowCloseDate } from '@/lib/time'

interface BettingWindowCountdownProps {
  closesAt: Date
}

export function BettingWindowCountdown({ closesAt }: BettingWindowCountdownProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  const closed = closesAt.getTime() <= now.getTime()

  if (closed) {
    return (
      <p className="mt-3 text-sm text-zinc-500">
        Betting window closed {formatWindowCloseDate(closesAt)}.
      </p>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
        Closes in {formatCountdown(closesAt, now)}
      </p>
      <p className="mt-1 text-sm text-zinc-300">{formatWindowCloseDate(closesAt)}</p>
    </div>
  )
}
