'use client'

import { useState } from 'react'
import { DeleteLeagueDialog } from '@/components/delete-league-dialog'
import { supabase } from '@/lib/supabase'

interface DeleteLeagueSectionProps {
  leagueId: string
  leagueName: string
  memberCount: number
  pendingBetCount: number
  onDeleted: () => void
}

export function DeleteLeagueSection({
  leagueId,
  leagueName,
  memberCount,
  pendingBetCount,
  onDeleted,
}: DeleteLeagueSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirmDelete() {
    setError(null)
    setDeleting(true)

    const { error: deleteError } = await supabase.rpc('delete_league', {
      p_league_id: leagueId,
    })

    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setDialogOpen(false)
    onDeleted()
  }

  return (
    <>
      <section className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
          Administrator
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Permanently delete this league and all associated data.
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            setDialogOpen(true)
          }}
          className="mt-4 w-full rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wide text-red-300 transition hover:bg-red-500/20"
        >
          Delete league
        </button>
      </section>

      <DeleteLeagueDialog
        open={dialogOpen}
        leagueName={leagueName}
        memberCount={memberCount}
        pendingBetCount={pendingBetCount}
        deleting={deleting}
        error={error}
        onClose={() => {
          if (!deleting) {
            setDialogOpen(false)
            setError(null)
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  )
}
