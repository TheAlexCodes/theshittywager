import type { Week } from '@/lib/database.types'

export interface FuturesWindowSettings {
  futures_opens_at?: string | null
  futures_closes_at?: string | null
}

export interface FuturesWindow {
  opensAt: Date
  closesAt: Date | null
  isOpen: boolean
}

export function getFuturesWindow(
  weeks: Week[],
  settings?: FuturesWindowSettings | null
): FuturesWindow | null {
  const futuresWeek = weeks.find((week) => week.phase === 'futures')
  if (!futuresWeek) return null

  const weekOne = weeks.find((week) => week.phase === 'regular' && week.week_number === 1)
  const opensAt = new Date(settings?.futures_opens_at ?? futuresWeek.reveal_at)
  const closesAt = settings?.futures_closes_at
    ? new Date(settings.futures_closes_at)
    : weekOne
      ? new Date(weekOne.reveal_at)
      : null

  const now = new Date()
  const isOpen = opensAt <= now && (closesAt === null || now < closesAt)

  return { opensAt, closesAt, isOpen }
}

export function futuresIsLocked(weeks: Week[], settings?: FuturesWindowSettings | null): boolean {
  const window = getFuturesWindow(weeks, settings)
  return window ? !window.isOpen : true
}

export function getFuturesWindowClosesAt(
  weeks: Week[],
  settings?: FuturesWindowSettings | null
): Date | null {
  return getFuturesWindow(weeks, settings)?.closesAt ?? null
}
