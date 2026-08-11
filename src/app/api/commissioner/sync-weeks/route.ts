import { NextResponse } from 'next/server'
import { requireCommissioner } from '@/lib/commissioner-auth'
import { buildWeeksFromEspn } from '@/lib/espn-schedule'

export async function POST(request: Request) {
  const auth = await requireCommissioner(request)

  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { supabase } = auth

  const { data: settings, error: settingsError } = await supabase
    .from('league_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (settingsError || !settings) {
    return NextResponse.json(
      { error: settingsError?.message ?? 'League settings not found.' },
      { status: 500 }
    )
  }

  try {
    const weeks = await buildWeeksFromEspn(settings.season_year, {
      weekly_allowance: settings.weekly_allowance,
      futures_allowance: settings.futures_allowance,
      playoff_allowance: settings.playoff_allowance,
    })

    const { error: upsertError } = await supabase.from('weeks').upsert(weeks, {
      onConflict: 'phase,week_number',
    })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ synced: weeks.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync weeks.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
