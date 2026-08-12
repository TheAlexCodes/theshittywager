'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function AuthCompleteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const authError = searchParams.get('error')

    if (authError) {
      setError(authError)
      return
    }

    const pendingInvite = sessionStorage.getItem('pending_invite')
    if (pendingInvite) {
      sessionStorage.removeItem('pending_invite')
      router.replace(`/join/${pendingInvite}`)
      return
    }

    router.replace('/')
  }, [router, searchParams])

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400">{error}</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
          >
            Back to login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <p className="text-sm text-zinc-400">Signing you in…</p>
    </main>
  )
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
          <p className="text-sm text-zinc-400">Signing you in…</p>
        </main>
      }
    >
      <AuthCompleteContent />
    </Suspense>
  )
}
