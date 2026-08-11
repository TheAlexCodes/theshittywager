'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LoginForm } from '@/components/login-form'
import { useLeague } from '@/lib/league-context'
import { useAuth } from '@/lib/use-auth'
import { supabase } from '@/lib/supabase'

export default function JoinLeaguePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token
  const { session, loading: authLoading } = useAuth()
  const { refreshMemberships, setActiveLeagueId } = useLeague()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !token) return

    let cancelled = false

    async function joinLeague() {
      setJoining(true)
      setError(null)

      const { data, error: rpcError } = await supabase.rpc('join_league_by_invite', {
        p_token: token,
      })

      if (cancelled) return

      if (rpcError) {
        setError(rpcError.message)
        setJoining(false)
        return
      }

      if (data) {
        setActiveLeagueId(data)
        await refreshMemberships()
        router.replace('/')
      }
    }

    joinLeague()

    return () => {
      cancelled = true
    }
  }, [session, token, router, refreshMemberships, setActiveLeagueId])

  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </main>
    )
  }

  if (!session) {
    if (typeof window !== 'undefined' && token) {
      sessionStorage.setItem('pending_invite', token)
    }
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto w-full max-w-lg px-4 py-6">
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 text-center">
            <p className="text-sm text-zinc-300">Sign in to join this league.</p>
          </section>
          <LoginForm />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 text-center">
        {error ? (
          <>
            <p className="text-red-400">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Go to league
            </Link>
          </>
        ) : (
          <p className="text-sm text-zinc-400">Joining league…</p>
        )}
      </div>
    </main>
  )
}
