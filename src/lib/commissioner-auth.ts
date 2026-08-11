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

export async function requireCommissioner(request: Request) {
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_commissioner')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return { error: profileError.message, status: 500 as const }
  }

  if (!profile?.is_commissioner) {
    return { error: 'Commissioner access required.', status: 403 as const }
  }

  return { supabase, user }
}
