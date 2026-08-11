import type { Week, WeekPhase } from '@/lib/database.types'

export function formatWeekLabel(week: Week): string {
  if (week.phase === 'futures') {
    return 'Futures'
  }

  if (week.phase === 'playoff') {
    return `Playoff · Week ${week.week_number}`
  }

  return `Week ${week.week_number}`
}

export function formatPhaseLabel(phase: WeekPhase): string {
  switch (phase) {
    case 'futures':
      return 'Futures'
    case 'regular':
      return 'Regular Season'
    case 'playoff':
      return 'Playoffs'
  }
}

export function isWeekOpen(week: Week): boolean {
  return new Date(week.reveal_at) <= new Date()
}

export function getCurrentBettingWeek(weeks: Week[]): Week | null {
  const openWeeks = weeks
    .filter((week) => week.phase !== 'futures' && isWeekOpen(week))
    .sort(
      (a, b) =>
        new Date(b.reveal_at).getTime() - new Date(a.reveal_at).getTime() ||
        b.week_number - a.week_number
    )

  return openWeeks[0] ?? null
}

export function getFuturesWeek(weeks: Week[]): Week | null {
  return weeks.find((week) => week.phase === 'futures') ?? null
}

export function futuresIsLocked(weeks: Week[]): boolean {
  return weeks.some((week) => week.phase === 'regular' && isWeekOpen(week))
}
