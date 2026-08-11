#!/usr/bin/env node
/**
 * Fetches the 2026 NFL schedule from ESPN and writes supabase/seed/2026_weeks.sql
 *
 * Usage: node scripts/seed-weeks-from-espn.mjs
 * Source: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const YEAR = 2026
const BETTING_OPENS_DAYS_BEFORE = 4

const REGULAR_ALLOWANCE = 100
const PLAYOFF_ALLOWANCE = 200
const FUTURES_ALLOWANCE = 300

async function fetchWeek(seasonType, week) {
  const url = new URL(
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
  )
  url.searchParams.set('seasontype', String(seasonType))
  url.searchParams.set('week', String(week))
  url.searchParams.set('year', String(YEAR))

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`ESPN API error ${response.status} for week ${week}`)
  }

  const data = await response.json()
  const dates = (data.events ?? [])
    .map((event) => new Date(event.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length === 0) {
    return null
  }

  return {
    espnWeek: data.week?.number ?? week,
    firstKickoff: dates[0],
    lastKickoff: dates[dates.length - 1],
    gameCount: dates.length,
  }
}

function bettingOpensAt(firstKickoff) {
  const opens = new Date(firstKickoff)
  opens.setUTCDate(opens.getUTCDate() - BETTING_OPENS_DAYS_BEFORE)
  opens.setUTCHours(17, 0, 0, 0)
  return opens
}

function toSqlTimestamp(date) {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00')
}

function sqlValue(value) {
  return `'${value.replace(/'/g, "''")}'`
}

async function main() {
  const rows = []

  const regularWeeks = []
  for (let week = 1; week <= 18; week += 1) {
    const result = await fetchWeek(2, week)
    if (!result) {
      console.warn(`No regular season data for week ${week}`)
      continue
    }
    regularWeeks.push(result)
    rows.push({
      week_number: week,
      phase: 'regular',
      allowance: REGULAR_ALLOWANCE,
      reveal_at: bettingOpensAt(result.firstKickoff),
      note: `Week ${week}: first game ${result.firstKickoff.toISOString()}`,
    })
  }

  const playoffMap = [
    { espnWeek: 1, week_number: 19, label: 'Wild Card' },
    { espnWeek: 2, week_number: 20, label: 'Divisional' },
    { espnWeek: 3, week_number: 21, label: 'Conference Championships' },
  ]

  for (const round of playoffMap) {
    const result = await fetchWeek(3, round.espnWeek)
    if (!result) {
      console.warn(`No playoff data for ${round.label}`)
      continue
    }
    rows.push({
      week_number: round.week_number,
      phase: 'playoff',
      allowance: PLAYOFF_ALLOWANCE,
      reveal_at: bettingOpensAt(result.firstKickoff),
      note: `${round.label}: first game ${result.firstKickoff.toISOString()}`,
    })
  }

  const firstRegularGame = regularWeeks[0]?.firstKickoff
  const futuresOpens = firstRegularGame
    ? new Date(firstRegularGame.getTime() - 90 * 24 * 60 * 60 * 1000)
    : new Date(`${YEAR}-06-01T17:00:00Z`)

  rows.unshift({
    week_number: 0,
    phase: 'futures',
    allowance: FUTURES_ALLOWANCE,
    reveal_at: futuresOpens,
    note: 'Futures window opens ~90 days before Week 1',
  })

  rows.sort((a, b) => a.week_number - b.week_number)

  const lines = [
    '-- 2026 NFL weeks seeded from ESPN schedule',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Source: https://www.espn.com/nfl/schedule/_/year/${YEAR}/seasontype/2`,
    '-- reveal_at = betting opens (4 days before first kickoff of the week)',
    '',
    'delete from public.weeks;',
    '',
    'insert into public.weeks (week_number, phase, allowance, reveal_at)',
    'values',
  ]

  const valueLines = rows.map((row, index) => {
    const suffix = index === rows.length - 1 ? ';' : ','
    return `  (${row.week_number}, ${sqlValue(row.phase)}, ${row.allowance}, ${sqlValue(toSqlTimestamp(row.reveal_at))})${suffix} -- ${row.note}`
  })

  lines.push(...valueLines)
  lines.push('')

  const outputDir = join(ROOT, 'supabase', 'seed')
  mkdirSync(outputDir, { recursive: true })
  const outputPath = join(outputDir, '2026_weeks.sql')
  writeFileSync(outputPath, lines.join('\n'))

  console.log(`Wrote ${rows.length} weeks to ${outputPath}`)
  for (const row of rows) {
    console.log(
      `  ${row.phase.padEnd(8)} week ${String(row.week_number).padStart(2)} opens ${row.reveal_at.toISOString()}`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
