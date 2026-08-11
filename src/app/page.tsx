'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({
      type: 'success',
      text: 'Check your email for the login link.',
    })
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-[0_0_40px_rgba(34,197,94,0.08)]">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
              The Shitty Wager
            </h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-green-500">
              NFL Betting League
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send Login Link'}
            </button>
          </form>

          {message && (
            <p
              className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
                message.type === 'success'
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {message.text}
            </p>
          )}
        </div>
      </div>
    </main>
  )
}
