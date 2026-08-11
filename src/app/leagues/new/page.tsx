'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/app-header'
import { LoginForm } from '@/components/login-form'
import { useLeague } from '@/lib/league-context'
import { useAuth } from '@/lib/use-auth'
import { supabase } from '@/lib/supabase'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

export default function NewLeaguePage() {
  const router = useRouter()
  const { session, loading: authLoading } = useAuth()
  const { refreshMemberships, setActiveLeagueId } = useLeague()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error: rpcError } = await supabase.rpc('create_league', {
      p_name: name.trim(),
    })

    setSubmitting(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    if (data) {
      setActiveLeagueId(data)
      await refreshMemberships()
      router.push('/')
    }
  }

  if (authLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </main>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <AppHeader />

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Create a league
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            You will be the commissioner and can invite others.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="league-name" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                League name
              </label>
              <input
                id="league-name"
                type="text"
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sunday Degens 2026"
                className={inputClassName}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 hover:bg-green-500 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create league'}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
