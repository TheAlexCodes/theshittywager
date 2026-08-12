export function isValidAmericanOdds(odds: number): boolean {
  return Number.isInteger(odds) && odds !== 0
}

/** Profit only (excludes returned stake). Matches DB function `american_odds_profit`. */
export function americanOddsProfit(stake: number, odds: number): number {
  if (!isValidAmericanOdds(odds) || stake <= 0) {
    throw new Error(`Invalid stake or American odds: stake=${stake}, odds=${odds}`)
  }

  if (odds < 0) {
    return Math.round(stake * (100 / Math.abs(odds)))
  }

  return Math.round(stake * (odds / 100))
}

/** Total return on a winning bet (stake + profit). */
export function americanOddsPayout(stake: number, odds: number): number {
  return stake + americanOddsProfit(stake, odds)
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function remainingAllowance(allowance: number, staked: number): number {
  return Math.max(0, allowance - staked)
}

export function sumStakes<T extends { stake: number | null }>(rows: T[]): number {
  return rows.reduce((total, row) => total + (row.stake ?? 0), 0)
}

export function aggregateStakesByPlayer(
  rows: Array<{ player_id: string; stake: number | null }>
): Record<string, number> {
  const map: Record<string, number> = {}

  for (const row of rows) {
    map[row.player_id] = (map[row.player_id] ?? 0) + (row.stake ?? 0)
  }

  return map
}

export function parseAmericanOdds(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const normalized =
    trimmed.startsWith('+') || trimmed.startsWith('-') ? trimmed : `+${trimmed}`
  const value = Number.parseInt(normalized, 10)

  if (!Number.isInteger(value) || value === 0) return null

  return value
}
