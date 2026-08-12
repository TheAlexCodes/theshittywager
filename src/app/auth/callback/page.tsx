'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function finishSignIn(router: ReturnType<typeof useRouter>) {
  const pendingInvite = sessionStorage.getItem('pending_invite')
  if (pendingInvite) {
    sessionStorage.removeItem('pending_invite')
    router.replace(`/join/${pendingInvite}`)
    return
  }

  router.replace('/')
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const oauthError =
      searchParams.get('error_description') ?? searchParams.get('error')

    if (oauthError) {
      setError(oauthError)
      return
    }

    const code = searchParams.get('code')

    async function handleCallback() {
      if (code) {
        const { error: authError } = await supabase.auth.exchangeCodeForSession(code)

        if (authError) {
          setError(authError.message)
          return
        }

        finishSignIn(router)
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        setError(sessionError.message)
        return
      }

      if (session) {
        finishSignIn(router)
        return
      }

      setError('Missing login code.')
    }

    handleCallback()
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
