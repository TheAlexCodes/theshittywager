import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export function createAuthedSupabase(accessToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}

export async function requireCommissioner(request: Request, leagueId?: string) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!accessToken) {
    return { error: 'Missing authorization token.', status: 401 as const }
  }

  const supabase = createAuthedSupabase(accessToken)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Invalid session.', status: 401 as const }
  }

  if (leagueId) {
    const { data: membership, error: membershipError } = await supabase
      .from('league_members')
      .select('is_commissioner')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      return { error: membershipError.message, status: 500 as const }
    }

    if (!membership?.is_commissioner) {
      return { error: 'Commissioner access required.', status: 403 as const }
    }
  }

  return { supabase, user }
}
