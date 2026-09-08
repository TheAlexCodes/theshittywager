'use client'

import { FuturesBoard } from '@/components/futures-board'
import { LoginForm } from '@/components/login-form'
import { useAuth } from '@/lib/use-auth'

export default function FuturesPage() {
  const { session, loading, userId } = useAuth()

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-sm text-zinc-400">Loading…</p>
      </main>
    )
  }

  if (!session || !userId) {
    return <LoginForm />
  }

  return <FuturesBoard userId={userId} />
}
