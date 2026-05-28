'use client'

import { useState } from 'react'
import { Mail, Clock, UserCheck, StickyNote } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import EditProfileDialog from '../EditProfileDialog'
import { getDisplayName, getInitials, isRecordId } from './helpers'
import { updateCoachContextAction } from '../actions'
import type { User } from '@/lib/types'

// ── Quick Notes inline + modal ────────────────────────────────────────────────

function ProfileQuickNotes({
  personId,
  initialNotes,
  canEdit,
}: {
  personId: string
  initialNotes: string | null
  canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (draft === saved) { setOpen(false); return }
    setSaving(true)
    await updateCoachContextAction(personId, { quickNotes: draft })
    setSaving(false)
    setSaved(draft)
    setOpen(false)
  }

  function handleCancel() {
    setDraft(saved)
    setOpen(false)
  }

  if (!saved && !canEdit) return null

  return (
    <>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
          Quick Notes
        </p>
        {saved ? (
          <button
            onClick={() => { setDraft(saved); setOpen(true) }}
            className="w-full text-left group"
            title={canEdit ? 'Click to edit' : 'Click to view'}
          >
            <p className="text-sm text-slate-600 line-clamp-5 group-hover:text-slate-800 transition-colors leading-relaxed whitespace-pre-wrap">
              {saved}
            </p>
          </button>
        ) : (
          canEdit && (
            <button
              onClick={() => { setDraft(''); setOpen(true) }}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors italic"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Add quick notes…
            </button>
          )
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) handleCancel() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Notes</DialogTitle>
          </DialogHeader>
          {canEdit ? (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
                  if (e.key === 'Escape') handleCancel()
                }}
                disabled={saving}
                rows={8}
                placeholder="Add quick notes about this person…"
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)] focus:border-transparent disabled:opacity-50"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <p className="text-xs text-slate-400">⌘↵ to save</p>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </>
          ) : (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{saved}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Profile card ──────────────────────────────────────────────────────────────

interface Props {
  user: User
  name: string
  initials: string
  contactEmail: string
  displayTitle?: string
  showPreferredName: boolean
  badges: Array<{ label: string; className: string }>
  coach: User | null
  teamLead: User | null
  userCanWrite: boolean
  quickNotes?: string | null
  personId?: string
}

export default function ProfileCardSection({
  user,
  name,
  initials,
  contactEmail,
  displayTitle,
  showPreferredName,
  badges,
  coach,
  teamLead,
  userCanWrite,
  quickNotes = null,
  personId,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      {userCanWrite && (
        <div className="flex items-start justify-between gap-2 mb-4 sm:mb-0">
          <span />
          <div className="flex items-center gap-3">
            <EditProfileDialog user={user} />
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        {(user.profilePhoto ?? user.avatarUrl) ? (
          <img
            src={(user.profilePhoto ?? user.avatarUrl)!}
            alt={name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-2xl font-bold flex-shrink-0 select-none">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-bold text-slate-900 leading-tight"
            style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}
          >
            {name}
          </h1>
          {showPreferredName && (
            <p className="text-sm text-slate-400 mt-0.5">Goes by &ldquo;{user.preferredName}&rdquo;</p>
          )}
          {displayTitle && (
            <p className="text-base text-slate-500 mt-0.5">{displayTitle}</p>
          )}
          {user.companyName && (
            <p className="text-sm text-slate-400 mt-0.5">{user.companyName}</p>
          )}
          {contactEmail && (
            <p className="flex items-center gap-1.5 text-sm text-slate-400 mt-1">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              {contactEmail}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            {user.timeAtCompany && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                {user.timeAtCompany}
              </span>
            )}
            {coach && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                Coach: {getDisplayName(coach)}
              </span>
            )}
            {teamLead && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <UserCheck className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                Team Lead: {getDisplayName(teamLead)}
              </span>
            )}
          </div>
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
          {badges.map((b) => (
            <span key={b.label} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${b.className}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}

      {personId && (
        <ProfileQuickNotes
          personId={personId}
          initialNotes={quickNotes}
          canEdit={userCanWrite}
        />
      )}
    </div>
  )
}
