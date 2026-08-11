import type { Profile } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export async function loadProfile(): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase.rpc('claim_profile_by_email')

  if (error) {
    // Fallback if migration 003 has not been run yet
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { profile: null, error: error.message }
    }

    const byId = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()

    if (byId.data) {
      return { profile: byId.data, error: null }
    }

    if (user.email) {
      const byEmail = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', user.email)
        .maybeSingle()

      if (byEmail.data) {
        return {
          profile: null,
          error:
            'Your profile exists but is not linked to this login. Run supabase/migrations/003_claim_profile_by_email.sql in Supabase, then refresh.',
        }
      }
    }

    return { profile: null, error: error.message }
  }

  return { profile: data, error: null }
}
