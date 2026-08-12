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

export interface ActiveBettingPeriod {
  mode: 'weekly' | 'futures'
  week: Week
  closesAt: Date | null
}

export function getWeeklyWindowClosesAt(weeks: Week[], currentWeek: Week): Date | null {
  const sorted = [...weeks]
    .filter((week) => week.phase !== 'futures')
    .sort((a, b) => a.week_number - b.week_number)

  const index = sorted.findIndex((week) => week.id === currentWeek.id)
  const nextWeek = index >= 0 ? sorted[index + 1] : undefined

  return nextWeek ? new Date(nextWeek.reveal_at) : null
}

export function getFuturesWindowClosesAt(weeks: Week[]): Date | null {
  const weekOne = weeks.find((week) => week.phase === 'regular' && week.week_number === 1)
  return weekOne ? new Date(weekOne.reveal_at) : null
}

export function getActiveBettingPeriod(weeks: Week[]): ActiveBettingPeriod | null {
  const currentWeek = getCurrentBettingWeek(weeks)
  if (currentWeek) {
    return {
      mode: 'weekly',
      week: currentWeek,
      closesAt: getWeeklyWindowClosesAt(weeks, currentWeek),
    }
  }

  const futuresWeek = getFuturesWeek(weeks)
  if (futuresWeek && !futuresIsLocked(weeks)) {
    return {
      mode: 'futures',
      week: futuresWeek,
      closesAt: getFuturesWindowClosesAt(weeks),
    }
  }

  return null
}
