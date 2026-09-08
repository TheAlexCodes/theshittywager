import type { WeekPhase } from '@/lib/database.types'
import {
  BETTING_OPENS_DAYS_BEFORE,
  bettingClosesAtFromKickoffs,
  bettingOpensAt,
} from '@/lib/nfl-schedule'

export { BETTING_OPENS_DAYS_BEFORE, bettingOpensAt } from '@/lib/nfl-schedule'

export interface LeagueAllowances {
  weekly_allowance: number
  futures_allowance: number
  playoff_allowance: number
}

export interface EspnWeekRow {
  league_id: string
  week_number: number
  phase: WeekPhase
  allowance: number
  reveal_at: string
  betting_closes_at: string | null
}

interface EspnWeekResult {
  firstKickoff: Date
  lastKickoff: Date
  gameCount: number
  kickoffs: Date[]
}

async function fetchEspnWeek(
  seasonType: number,
  week: number,
  year: number
): Promise<EspnWeekResult | null> {
  const url = new URL(
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
  )
  url.searchParams.set('seasontype', String(seasonType))
  url.searchParams.set('week', String(week))
  url.searchParams.set('year', String(year))

  const response = await fetch(url, { next: { revalidate: 0 } })
  if (!response.ok) {
    throw new Error(`ESPN API error ${response.status} for week ${week}`)
  }

  const data = await response.json()
  const kickoffs = (data.events ?? [])
    .map((event: { date?: string }) => new Date(event.date ?? ''))
    .filter((date: Date) => !Number.isNaN(date.getTime()))
    .sort((a: Date, b: Date) => a.getTime() - b.getTime())

  if (kickoffs.length === 0) {
    return null
  }

  return {
    firstKickoff: kickoffs[0],
    lastKickoff: kickoffs[kickoffs.length - 1],
    gameCount: kickoffs.length,
    kickoffs,
  }
}

function buildWeekRow(
  leagueId: string,
  weekNumber: number,
  phase: WeekPhase,
  allowance: number,
  result: EspnWeekResult
): EspnWeekRow {
  const closesAt = bettingClosesAtFromKickoffs(result.kickoffs)

  return {
    league_id: leagueId,
    week_number: weekNumber,
    phase,
    allowance,
    reveal_at: bettingOpensAt(result.firstKickoff).toISOString(),
    betting_closes_at: closesAt?.toISOString() ?? null,
  }
}

export async function buildWeeksFromEspn(
  year: number,
  allowances: LeagueAllowances,
  leagueId: string
): Promise<EspnWeekRow[]> {
  const rows: EspnWeekRow[] = []
  const regularWeeks: EspnWeekResult[] = []

  for (let week = 1; week <= 18; week += 1) {
    const result = await fetchEspnWeek(2, week, year)
    if (!result) continue

    regularWeeks.push(result)
    rows.push(
      buildWeekRow(leagueId, week, 'regular', allowances.weekly_allowance, result)
    )
  }

  const playoffMap = [
    { espnWeek: 1, week_number: 19 },
    { espnWeek: 2, week_number: 20 },
    { espnWeek: 3, week_number: 21 },
  ]

  for (const round of playoffMap) {
    const result = await fetchEspnWeek(3, round.espnWeek, year)
    if (!result) continue

    rows.push(
      buildWeekRow(leagueId, round.week_number, 'playoff', allowances.playoff_allowance, result)
    )
  }

  const firstRegularGame = regularWeeks[0]?.firstKickoff
  const futuresOpens = firstRegularGame
    ? new Date(firstRegularGame.getTime() - 90 * 24 * 60 * 60 * 1000)
    : new Date(`${year}-06-01T17:00:00Z`)

  rows.unshift({
    league_id: leagueId,
    week_number: 0,
    phase: 'futures',
    allowance: allowances.futures_allowance,
    reveal_at: futuresOpens.toISOString(),
    betting_closes_at: null,
  })

  return rows.sort((a, b) => a.week_number - b.week_number)
}
