'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Clock, UserCheck, StickyNote, Cake, CalendarDays, Check, X, Plus, Pencil } from 'lucide-react'
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
import { updateCoachContextAction, updateProfileAction } from '../actions'
import type { Human } from '@/lib/types'
import { useDraftSave, clearDraft, loadDraft } from '@/hooks/useDraftSave'

// ── Inline date chip ──────────────────────────────────────────────────────────

function InlineDateChip({
  icon,
  value,
  label,
  format,
  onSave,
  canEdit,
}: {
  icon: React.ReactNode
  value: string | undefined
  label: string
  format: 'month-day' | 'month-year'
  onSave: (v: string) => Promise<void>
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  function formatDisplay(v: string) {
    if (!v) return ''
    const d = new Date(v + 'T12:00:00')
    if (format === 'month-day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  async function commit() {
    if (draft === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="text-xs border border-[hsl(213,70%,30%)] rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-card"
          disabled={saving}
        />
        <button onClick={commit} disabled={saving} className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={() => { setDraft(value ?? ''); setEditing(false) }} className="p-0.5 rounded text-muted-foreground hover:bg-muted">
          <X className="h-3 w-3" />
        </button>
      </span>
    )
  }

  if (!value && canEdit) {
    return (
      <button
        onClick={() => { setDraft(''); setEditing(true) }}
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {icon}
        <span>{label}</span>
        <Plus className="h-2.5 w-2.5" />
      </button>
    )
  }

  if (!value) return null

  return (
    <button
      onClick={canEdit ? () => { setDraft(value ?? ''); setEditing(true) } : undefined}
      className={`group flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground ${canEdit ? 'hover:bg-muted transition-colors cursor-pointer' : 'cursor-default'}`}
    >
      {icon}
      <span>{formatDisplay(value)}</span>
      {canEdit && <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40 transition-opacity" />}
    </button>
  )
}

// ── Quick Notes inline + modal ────────────────────────────────────────────────

function ProfileQuickNotes({
  personId,
  rcId,
  initialNotes,
  canEdit,
}: {
  personId: string
  rcId: string | null
  initialNotes: string | null
  canEdit: boolean
}) {
  const draftKey = `qn-draft-${personId}`
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [saved, setSaved] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const hasChanges = draft !== saved

  // Restore any unsaved draft from localStorage on mount
  useEffect(() => {
    const stored = loadDraft(draftKey)
    if (stored !== null && stored !== (initialNotes ?? '')) {
      setDraft(stored)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft to localStorage while the user is typing
  useDraftSave(draftKey, draft, hasChanges)

  async function handleSave() {
    if (draft === saved) { setOpen(false); return }
    if (!rcId) { setOpen(false); return }
    setSaving(true)
    await updateCoachContextAction(personId, rcId, draft)
    clearDraft(draftKey)
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
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
          Quick Notes
        </p>
        {canEdit && (
          <p className="text-[10px] text-muted-foreground/50 mb-1.5">
            {saved ? 'click to edit' : 'click to add'}
          </p>
        )}
        {saved ? (
          <button
            onClick={() => { setDraft(saved); setOpen(true) }}
            className="w-full text-left group"
            title={canEdit ? 'Click to edit' : 'Click to view'}
          >
            <p className="text-sm text-muted-foreground line-clamp-5 group-hover:text-foreground transition-colors leading-relaxed whitespace-pre-wrap">
              {saved}
            </p>
          </button>
        ) : (
          canEdit && (
            <button
              onClick={() => { setDraft(''); setOpen(true) }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-muted-foreground transition-colors italic"
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
                className="w-full text-sm text-foreground border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)] focus:border-transparent disabled:opacity-50"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <p className="text-xs text-muted-foreground">⌘↵ to save</p>
              <DialogFooter>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </>
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{saved}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Profile card ──────────────────────────────────────────────────────────────

interface Props {
  user: Human
  name: string
  initials: string
  contactEmail: string
  displayTitle?: string
  showPreferredName: boolean
  badges: Array<{ label: string; className: string }>
  coach: Human | null
  teamLead: Human | null
  userCanWrite: boolean
  quickNotes?: string | null
  quickNoteRcId?: string | null
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
  quickNoteRcId = null,
  personId,
}: Props) {
  const router = useRouter()

  async function saveDateField(field: 'Birthday' | 'Start Date', value: string) {
    await updateProfileAction(user.id, { [field]: value })
    router.refresh()
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      {userCanWrite && (
        <div className="flex items-start justify-between gap-2 mb-4 sm:mb-0">
          <span />
          <div className="flex items-center gap-3">
            <EditProfileDialog user={user} initialQuickNotes={quickNotes} quickNoteRcId={quickNoteRcId} />
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
        {user.profilePhoto ? (
          <img
            src={user.profilePhoto}
            alt={name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 flex items-center justify-center text-2xl font-bold flex-shrink-0 select-none">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-bold text-foreground leading-tight"
            style={{ fontFamily: 'var(--font-plus-jakarta-sans)' }}
          >
            {name}
          </h1>
          {showPreferredName && (
            <p className="text-sm text-muted-foreground mt-0.5">Goes by &ldquo;{user.preferredName}&rdquo;</p>
          )}
          {displayTitle && (
            <p className="text-base text-muted-foreground mt-0.5">{displayTitle}</p>
          )}
          {user.companyName && (
            <p className="text-sm text-muted-foreground mt-0.5">{user.companyName}</p>
          )}
          {contactEmail && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              {contactEmail}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
            {user.timeAtCompany && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                {user.timeAtCompany}
              </span>
            )}
            {coach && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                Coach: {getDisplayName(coach)}
              </span>
            )}
            {teamLead && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                Team Lead: {getDisplayName(teamLead)}
              </span>
            )}
          </div>

          {/* Birthday + Start Date chips */}
          {(userCanWrite || user.birthday || user.startDate) && (
            <div className="mt-2 flex flex-wrap gap-2">
              <InlineDateChip
                icon={<Cake className="h-3 w-3" />}
                value={user.birthday}
                label="Birthday"
                format="month-day"
                canEdit={userCanWrite}
                onSave={(v) => saveDateField('Birthday', v)}
              />
              <InlineDateChip
                icon={<CalendarDays className="h-3 w-3" />}
                value={user.startDate}
                label="Start Date"
                format="month-year"
                canEdit={userCanWrite}
                onSave={(v) => saveDateField('Start Date', v)}
              />
            </div>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-border">
          {badges.map((b) => (
            <span key={b.label} className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${b.className}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}

      {personId && quickNoteRcId && (
        <ProfileQuickNotes
          personId={personId}
          rcId={quickNoteRcId}
          initialNotes={quickNotes}
          canEdit={userCanWrite}
        />
      )}
    </div>
  )
}
