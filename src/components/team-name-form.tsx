'use client'

import { FormEvent, useState } from 'react'
import { supabase } from '@/lib/supabase'

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder:text-zinc-600 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/20'

interface TeamNameFormProps {
  userId: string
  initialTeamName: string
  onSaved: (teamName: string) => void
}

export function TeamNameForm({ userId, initialTeamName, onSaved }: TeamNameFormProps) {
  const [teamName, setTeamName] = useState(initialTeamName)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)

    const trimmed = teamName.trim()
    if (!trimmed) {
      setMessage({ type: 'error', text: 'Team name cannot be empty.' })
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', userId)

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    setTeamName(trimmed)
    setMessage({ type: 'success', text: 'Team name updated.' })
    onSaved(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="team-name" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Team name
        </label>
        <input
          id="team-name"
          type="text"
          required
          maxLength={40}
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="Your team name"
          className={inputClassName}
        />
        <p className="mt-2 text-xs text-zinc-500">
          Shown on the standings and across the league.
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-green-500 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save team name'}
      </button>

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
    </form>
  )
}
