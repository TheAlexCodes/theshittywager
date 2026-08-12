'use client'

import Link from 'next/link'
import { AppHeader } from '@/components/app-header'
import { CommissionerTools } from '@/components/commissioner-tools'
import { LoginForm } from '@/components/login-form'
import { useLeague } from '@/lib/league-context'
import { useAuth } from '@/lib/use-auth'

export default function AdminPage() {
  const { session, loading: authLoading, userId } = useAuth()
  const { activeLeagueId, isCommissioner, loading: leagueLoading, refreshMemberships } = useLeague()

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

  if (!isCommissioner) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader />
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">Admin access is limited to this league&apos;s commissioner.</p>
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
            currentUserId={userId}
            onUpdated={refreshMemberships}
          />
        )}
      </div>
    </main>
  )
}
