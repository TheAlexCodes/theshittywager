export const NFL_SCHEDULE_TIMEZONE = 'America/New_York'

export const BETTING_OPENS_DAYS_BEFORE = 4

export function isWeekendKickoff(kickoff: Date): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: NFL_SCHEDULE_TIMEZONE,
    weekday: 'short',
  }).format(kickoff)

  return weekday === 'Sat' || weekday === 'Sun'
}

export function firstWeekendKickoff(kickoffs: Date[]): Date | null {
  const sorted = [...kickoffs].sort((a, b) => a.getTime() - b.getTime())
  return sorted.find(isWeekendKickoff) ?? null
}

/** Betting closes when the first Saturday or Sunday game kicks off. */
export function bettingClosesAtFromKickoffs(kickoffs: Date[]): Date | null {
  const firstWeekend = firstWeekendKickoff(kickoffs)
  if (firstWeekend) return firstWeekend

  if (kickoffs.length === 0) return null

  return [...kickoffs].sort((a, b) => a.getTime() - b.getTime())[0] ?? null
}

export function bettingOpensAt(firstKickoff: Date): Date {
  const opens = new Date(firstKickoff)
  opens.setUTCDate(opens.getUTCDate() - BETTING_OPENS_DAYS_BEFORE)
  opens.setUTCHours(17, 0, 0, 0)
  return opens
}
