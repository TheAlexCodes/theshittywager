'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Dashboard } from '@/components/dashboard'
import { LoginForm } from '@/components/login-form'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </main>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return <Dashboard userId={session.user.id} />
}
