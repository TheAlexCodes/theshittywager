'use client'

import { AppHeader } from '@/components/app-header'
import { TeamNameForm } from '@/components/team-name-form'
import { LoginForm } from '@/components/login-form'
import { useLeague } from '@/lib/league-context'
import { loadProfile } from '@/lib/profile'
import { formatMoney } from '@/lib/odds'
import { useAuth } from '@/lib/use-auth'
import { useCallback, useEffect, useState } from 'react'
import type { Profile } from '@/lib/database.types'

export default function ProfilePage() {
  const { session, loading: authLoading, userId } = useAuth()
  const { activeMembership, isCommissioner, isAdministrator } = useLeague()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(async () => {
    if (!userId) return

    setError(null)
    const result = await loadProfile()

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setProfile(result.profile)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) {
      setLoading(true)
      loadPage()
    }
  }, [userId, loadPage])

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading profile…</p>
      </main>
    )
  }

  if (!session || !userId) {
    return <LoginForm />
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <p className="text-red-400">{error ?? 'Profile not found.'}</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <AppHeader />

        <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Your profile
          </p>
          {activeMembership && (
            <p className="mt-3 text-3xl font-black text-green-400">
              {formatMoney(activeMembership.bankroll)}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">Play-money bankroll in active league</p>
          <p className="mt-4 text-sm text-zinc-400">{profile.email}</p>
          {isAdministrator && (
            <span className="mt-3 inline-block rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-300">
              Administrator
            </span>
          )}
          {!isAdministrator && isCommissioner && (
            <span className="mt-3 inline-block rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
              Commissioner
            </span>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Team settings
          </p>
          <TeamNameForm
            userId={userId}
            initialTeamName={profile.display_name}
            onSaved={(teamName) => setProfile({ ...profile, display_name: teamName })}
          />
        </section>
      </div>
    </main>
  )
}
