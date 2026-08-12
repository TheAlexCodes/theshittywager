'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatMoney } from '@/lib/odds'
import { supabase } from '@/lib/supabase'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

interface RosterMember {
  userId: string
  email: string
  displayName: string
  bankroll: number
  isCommissioner: boolean
}

interface LeagueRosterManagerProps {
  leagueId: string
  currentUserId: string
  onUpdated: () => void
}

export function LeagueRosterManager({
  leagueId,
  currentUserId,
  onUpdated,
}: LeagueRosterManagerProps) {
  const [members, setMembers] = useState<RosterMember[]>([])
  const [draftNames, setDraftNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadRoster = useCallback(async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('league_members')
      .select('user_id, bankroll, is_commissioner, profiles(email, display_name)')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }

    const rows: RosterMember[] = (data ?? []).map((row) => ({
      userId: row.user_id,
      email: row.profiles?.email ?? '',
      displayName: row.profiles?.display_name ?? 'Player',
      bankroll: row.bankroll,
      isCommissioner: row.is_commissioner,
    }))

    setMembers(rows)
    setDraftNames(Object.fromEntries(rows.map((row) => [row.userId, row.displayName])))
    setLoading(false)
  }, [leagueId])

  useEffect(() => {
    loadRoster()
  }, [loadRoster])

  async function saveTeamName(userId: string) {
    const displayName = draftNames[userId]?.trim()

    if (!displayName) {
      setMessage({ type: 'error', text: 'Team name cannot be empty.' })
      return
    }

    setSavingUserId(userId)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', userId)

    setSavingUserId(null)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({ type: 'success', text: 'Team name updated.' })
    await loadRoster()
    onUpdated()
  }

  async function toggleCommissioner(userId: string, nextValue: boolean) {
    setSavingUserId(userId)
    setMessage(null)

    const { error } = await supabase
      .from('league_members')
      .update({ is_commissioner: nextValue })
      .eq('league_id', leagueId)
      .eq('user_id', userId)

    setSavingUserId(null)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setMessage({
      type: 'success',
      text: nextValue ? 'Commissioner access granted.' : 'Commissioner access removed.',
    })
    await loadRoster()
    onUpdated()
  }

  if (loading) {
    return <p className="text-sm text-zinc-400">Loading roster…</p>
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const saving = savingUserId === member.userId
        const nameChanged = draftNames[member.userId]?.trim() !== member.displayName
        const isSelf = member.userId === currentUserId

        return (
          <div
            key={member.userId}
            className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-zinc-500">{member.email}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-300">
                  {formatMoney(member.bankroll)}
                  {isSelf && (
                    <span className="ml-2 text-xs font-normal text-green-400">You</span>
                  )}
                </p>
              </div>
              {member.isCommissioner && (
                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Commissioner
                </span>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor={`team-name-${member.userId}`}
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  Team name
                </label>
                <div className="flex gap-2">
                  <input
                    id={`team-name-${member.userId}`}
                    type="text"
                    maxLength={40}
                    value={draftNames[member.userId] ?? ''}
                    onChange={(event) =>
                      setDraftNames((current) => ({
                        ...current,
                        [member.userId]: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                  <button
                    type="button"
                    disabled={saving || !nameChanged}
                    onClick={() => saveTeamName(member.userId)}
                    className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 hover:border-zinc-500 disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={member.isCommissioner}
                  disabled={saving || (member.isCommissioner && isSelf && members.filter((row) => row.isCommissioner).length === 1)}
                  onChange={(event) => toggleCommissioner(member.userId, event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-green-600 focus:ring-green-500/30"
                />
                Commissioner access
              </label>
            </div>
          </div>
        )
      })}

      {message && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
