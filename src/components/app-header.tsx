'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LeagueRulesDialog } from '@/components/league-rules-dialog'
import { useLeague } from '@/lib/league-context'
import { supabase } from '@/lib/supabase'

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [rulesOpen, setRulesOpen] = useState(false)
  const {
    memberships,
    activeLeagueId,
    activeLeague,
    isCommissioner,
    setActiveLeagueId,
  } = useLeague()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const links = [
    { href: '/', label: 'League' },
    { href: '/profile', label: 'Profile' },
    ...(isCommissioner ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-black uppercase tracking-tight truncate">
            {activeLeague?.name ?? 'The Shitty Wager'}
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-500">
            NFL Betting League
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            aria-label="How it works"
          >
            Info
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>

      {memberships.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="league-switcher" className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            League
          </label>
          <select
            id="league-switcher"
            value={activeLeagueId ?? ''}
            onChange={(event) => setActiveLeagueId(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-green-500"
          >
            {memberships.map((membership) => (
              <option key={membership.league_id} value={membership.league_id}>
                {membership.leagues?.name ?? 'League'}
              </option>
            ))}
          </select>
          <Link
            href="/leagues/new"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            New
          </Link>
        </div>
      )}

      <nav className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => {
          const active = pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                active
                  ? link.href === '/admin'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : 'border border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>

      <LeagueRulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </header>
  )
}
