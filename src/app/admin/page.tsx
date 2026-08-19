'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { CommissionerTools } from '@/components/commissioner-tools'
import { LoginForm } from '@/components/login-form'
import { useLeague } from '@/lib/league-context'
import { useAuth } from '@/lib/use-auth'

export default function AdminPage() {
  const router = useRouter()
  const { session, loading: authLoading, userId } = useAuth()
  const {
    activeLeagueId,
    activeLeague,
    canManageActiveLeague,
    loading: leagueLoading,
    refreshMemberships,
    isAdministrator,
    memberships,
  } = useLeague()

  if (authLoading || leagueLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading admin…</p>
      </main>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  if (!activeLeagueId) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader />
          <p className="text-zinc-400">Select or create a league first.</p>
        </div>
      </main>
    )
  }

  if (!canManageActiveLeague) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader />
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">Admin access is limited to commissioners and platform administrators.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Back to league
            </Link>
          </section>
        </div>
      </main>
    )
  }

  const leagueName =
    activeLeague?.name ??
    memberships.find((membership) => membership.league_id === activeLeagueId)?.leagues?.name ??
    'League'

  async function handleLeagueDeleted() {
    await refreshMemberships()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <AppHeader />

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Admin</p>
          <p className="mt-1 text-sm text-zinc-400">
            Commissioner controls for players, budgets, invites, schedule sync, and bet settlement.
          </p>
        </div>

        {userId && (
          <CommissionerTools
            leagueId={activeLeagueId}
            leagueName={leagueName}
            currentUserId={userId}
            isPlatformAdministrator={isAdministrator}
            onUpdated={refreshMemberships}
            onLeagueDeleted={isAdministrator ? handleLeagueDeleted : undefined}
          />
        )}
      </div>
    </main>
  )
}
