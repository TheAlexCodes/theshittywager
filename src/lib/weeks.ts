import type { Week, WeekPhase } from '@/lib/database.types'
import {
  futuresIsLocked as futuresIsLockedWithSettings,
  getFuturesWindowClosesAt as getFuturesWindowClosesAtWithSettings,
  type FuturesWindowSettings,
} from '@/lib/futures-window'

export type { FuturesWindowSettings } from '@/lib/futures-window'
export { getFuturesWindow } from '@/lib/futures-window'

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
  return isWeekBettingOpen(week)
}

export function isWeekBettingOpen(week: Week): boolean {
  const now = new Date()
  if (new Date(week.reveal_at) > now) return false
  if (week.betting_closes_at && new Date(week.betting_closes_at) <= now) return false
  return true
}

export function getCurrentBettingWeek(weeks: Week[]): Week | null {
  const openWeeks = weeks
    .filter((week) => week.phase !== 'futures' && isWeekBettingOpen(week))
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

export function futuresIsLocked(
  weeks: Week[],
  settings?: FuturesWindowSettings | null
): boolean {
  return futuresIsLockedWithSettings(weeks, settings)
}

export interface ActiveBettingPeriod {
  mode: 'weekly' | 'futures'
  week: Week
  closesAt: Date | null
}

export function getWeeklyWindowClosesAt(weeks: Week[], currentWeek: Week): Date | null {
  if (currentWeek.betting_closes_at) {
    return new Date(currentWeek.betting_closes_at)
  }

  const sorted = [...weeks]
    .filter((week) => week.phase !== 'futures')
    .sort((a, b) => a.week_number - b.week_number)

  const index = sorted.findIndex((week) => week.id === currentWeek.id)
  const nextWeek = index >= 0 ? sorted[index + 1] : undefined

  return nextWeek ? new Date(nextWeek.reveal_at) : null
}

export function getFuturesWindowClosesAt(
  weeks: Week[],
  settings?: FuturesWindowSettings | null
): Date | null {
  return getFuturesWindowClosesAtWithSettings(weeks, settings)
}

export function getActiveBettingPeriod(
  weeks: Week[],
  settings?: FuturesWindowSettings | null
): ActiveBettingPeriod | null {
  const currentWeek = getCurrentBettingWeek(weeks)
  if (currentWeek) {
    return {
      mode: 'weekly',
      week: currentWeek,
      closesAt: getWeeklyWindowClosesAt(weeks, currentWeek),
    }
  }

  const futuresWeek = getFuturesWeek(weeks)
  if (futuresWeek && !futuresIsLocked(weeks, settings)) {
    return {
      mode: 'futures',
      week: futuresWeek,
      closesAt: getFuturesWindowClosesAt(weeks, settings),
    }
  }

  return null
}
