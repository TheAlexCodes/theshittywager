'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')

    if (!code) {
      setError('Missing login code.')
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: authError }) => {
      if (authError) {
        setError(authError.message)
        return
      }

      const pendingInvite = sessionStorage.getItem('pending_invite')
      if (pendingInvite) {
        sessionStorage.removeItem('pending_invite')
        router.replace(`/join/${pendingInvite}`)
        return
      }

      router.replace('/')
    })
  }, [router, searchParams])

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <p className="text-sm text-zinc-400">
        {error ?? 'Signing you in…'}
      </p>
    </main>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
          <p className="text-sm text-zinc-400">Signing you in…</p>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
