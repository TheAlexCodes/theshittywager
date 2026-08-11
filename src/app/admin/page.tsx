'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { CommissionerTools } from '@/components/commissioner-tools'
import { LoginForm } from '@/components/login-form'
import type { Profile } from '@/lib/database.types'
import { loadProfile } from '@/lib/profile'
import { useAuth } from '@/lib/use-auth'

export default function AdminPage() {
  const { session, loading: authLoading, userId } = useAuth()
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

  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </main>
    )
  }

  if (!session || !userId) {
    return <LoginForm />
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading admin…</p>
      </main>
    )
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <p className="text-red-400">{error ?? 'Profile not found.'}</p>
      </main>
    )
  }

  if (!profile.is_commissioner) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <AppHeader isCommissioner={false} />
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-red-400">Admin access is limited to commissioners.</p>
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
        <AppHeader isCommissioner />

        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Admin</p>
          <p className="mt-1 text-sm text-zinc-400">
            Commissioner controls for budgets, schedule sync, and bet settlement.
          </p>
        </div>

        <CommissionerTools onUpdated={loadPage} />
      </div>
    </main>
  )
}
