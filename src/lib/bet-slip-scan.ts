export type BetScanConfidence = 'high' | 'medium' | 'low'

export interface ScannedBetSlip {
  selection: string
  bet_type: string | null
  category: string | null
  american_odds: number | null
  stake: number | null
  is_futures: boolean | null
  confidence: BetScanConfidence
  notes: string | null
}

export interface AppliedBetScan {
  betType: string
  category: string
  selection: string
  stake: string
  oddsInput: string
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite'

export function getGeminiModelName(): string {
  return GEMINI_MODEL
}

export function buildBetScanPrompt(mode: 'weekly' | 'futures'): string {
  return `You extract structured bet data from sportsbook screenshots (DraftKings, FanDuel, ESPN BET, etc.).

The user is entering a ${mode === 'weekly' ? 'weekly NFL wager' : 'season-long futures wager'} in a fake-money league.

Return JSON only with these fields:
- selection (string, required): the pick exactly as a bettor would describe it, e.g. "ATL Falcons", "Chiefs -3.5", "Over 47.5"
- bet_type (string or null): for game bets — Spread, Moneyline, Total, Prop, Winner, Parlay leg, etc.
- category (string or null): for futures — MVP, Super Bowl Winner, Coach of the Year, etc.
- american_odds (integer or null): American odds as an integer. Examples: -110, +200, +13000. Favorites are negative.
- stake (integer or null): wager amount in whole US dollars if visible on the slip
- is_futures (boolean or null): true for season-long bets, false for single-game/week bets
- confidence ("high" | "medium" | "low"): how confident you are in the extraction
- notes (string or null): mention anything unclear, cropped, or ambiguous

Rules:
- Prefer the main/active bet on the slip if multiple are shown
- Ignore account balances, crown cash, and payout unless needed to infer stake
- If odds show a plus sign, return a positive integer
- If stake is not visible, return null for stake
- Do not invent values`
}

export function parseScannedBetSlip(raw: unknown): ScannedBetSlip | null {
  if (!raw || typeof raw !== 'object') return null

  const data = raw as Record<string, unknown>
  const selection = typeof data.selection === 'string' ? data.selection.trim() : ''

  if (!selection) return null

  const americanOdds = parseOddsValue(data.american_odds)
  const stake = parseStakeValue(data.stake)
  const confidence = parseConfidence(data.confidence)

  return {
    selection,
    bet_type: parseOptionalString(data.bet_type),
    category: parseOptionalString(data.category),
    american_odds: americanOdds,
    stake,
    is_futures: typeof data.is_futures === 'boolean' ? data.is_futures : null,
    confidence,
    notes: parseOptionalString(data.notes),
  }
}

export function applyScanToForm(
  scan: ScannedBetSlip,
  mode: 'weekly' | 'futures'
): AppliedBetScan {
  return {
    betType: mode === 'weekly' ? (scan.bet_type ?? '') : '',
    category: mode === 'futures' ? (scan.category ?? scan.bet_type ?? '') : '',
    selection: scan.selection,
    stake: scan.stake !== null ? String(scan.stake) : '',
    oddsInput:
      scan.american_odds !== null
        ? scan.american_odds > 0
          ? `+${scan.american_odds}`
          : String(scan.american_odds)
        : '',
  }
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseOddsValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value !== 0) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/^\+/, '')
    const parsed = Number.parseInt(normalized, 10)
    if (Number.isInteger(parsed) && parsed !== 0) {
      return value.trim().startsWith('-') ? -Math.abs(parsed) : parsed
    }
  }

  return null
}

function parseStakeValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function parseConfidence(value: unknown): BetScanConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value
  }

  return 'medium'
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
}

export async function scanBetSlipWithGemini(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
  mode: 'weekly' | 'futures'
): Promise<ScannedBetSlip> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: buildBetScanPrompt(mode) },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              selection: { type: 'string' },
              bet_type: { type: 'string', nullable: true },
              category: { type: 'string', nullable: true },
              american_odds: { type: 'integer', nullable: true },
              stake: { type: 'integer', nullable: true },
              is_futures: { type: 'boolean', nullable: true },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              notes: { type: 'string', nullable: true },
            },
            required: ['selection', 'confidence'],
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Vision API error (${response.status}): ${errorBody.slice(0, 200)}`)
  }

  const payload = (await response.json()) as GeminiResponse
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    throw new Error('Vision API returned no result.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Vision API returned invalid JSON.')
  }

  const scan = parseScannedBetSlip(parsed)

  if (!scan) {
    throw new Error('Could not read a bet from that image.')
  }

  return scan
}

export const ALLOWED_BET_SCAN_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

export const MAX_BET_SCAN_FILE_BYTES = 5 * 1024 * 1024
