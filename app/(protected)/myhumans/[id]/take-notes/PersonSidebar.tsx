'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Check, Pencil, X, Plus,
  ChevronDown, ChevronUp, Network,
  Cake, CalendarDays, StickyNote,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  updateProfileAction,
  updateCoachContextAction,
  upsertRCNoteAction,
} from '../actions'
import RelationshipDialog from '../RelationshipDialog'
import type { User } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'
import type { ProfileOption } from '@/lib/airtable/users'
import type { RelationshipContext } from '@/lib/airtable/relationships'
import type { Note } from '@/lib/airtable/notes'
import { useDraftSave, clearDraft, loadDraft } from '@/hooks/useDraftSave'

interface ProfileOptions {
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allUsers: ProfileOption[]
}

interface Props {
  person: User
  coachContext: CoachPersonContext | null
  profileOptions: ProfileOptions
  userCanWrite: boolean
  onPersonUpdate?: (partial: Partial<User>) => void
  relationships?: RelationshipContext[]
  rcNotes?: Map<string, Note>
  currentCoachId?: string
}

// ── Relationship classification (mirrors RelationshipsSection) ────────────────

interface BucketItem {
  rc: RelationshipContext
  otherPersonId: string
  otherName: string
  otherTitle?: string
  role: 'coach' | 'coachee' | 'manager' | 'report' | 'client' | 'prospect' | 'personal' | 'peer'
}

function classifyRelationship(rc: RelationshipContext, subjectId: string): BucketItem | null {
  const subjectIsPerson = rc.personId === subjectId
  const otherPersonId = subjectIsPerson ? rc.leadId : rc.personId
  const otherName     = subjectIsPerson ? rc.leadName : rc.personName
  const otherTitle    = subjectIsPerson ? rc.leadTitle : rc.personTitle
  if (rc.relationshipType === 'coaching') {
    return { rc, otherPersonId, otherName, otherTitle, role: subjectIsPerson ? 'coach' : 'coachee' }
  }
  if (rc.relationshipType === 'reports_to') {
    return { rc, otherPersonId, otherName, otherTitle, role: subjectIsPerson ? 'manager' : 'report' }
  }
  if (rc.relationshipType === 'client') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'client' }
  }
  if (rc.relationshipType === 'prospect') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'prospect' }
  }
  if (rc.relationshipType === 'personal') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'personal' }
  }
  if (rc.relationshipType === 'peer') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'peer' }
  }
  return null
}

// ── Edit Name Dialog ──────────────────────────────────────────────────────────

function EditNameDialog({
  person,
  onSave,
}: {
  person: User
  onSave: (firstName: string, lastName: string, preferredName: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [saving, setSaving] = useState(false)

  function handleOpen() {
    setFirstName(person.firstName ?? '')
    setLastName(person.lastName ?? '')
    setPreferredName(person.preferredName ?? '')
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    await onSave(firstName, lastName, preferredName)
    setSaving(false)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-1 rounded text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
        aria-label="Edit name"
      >
        <Pencil className="h-3 w-3" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) setOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first">First Name</Label>
              <Input
                id="edit-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last">Last Name</Label>
              <Input
                id="edit-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-preferred">Preferred Name</Label>
              <Input
                id="edit-preferred"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                placeholder="Optional"
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Inline date field chip ─────────────────────────────────────────────────────

function InlineDateField({
  icon,
  value,
  format,
  onSave,
  label,
}: {
  icon: React.ReactNode
  value: string | undefined
  format: 'month-day' | 'month-year'
  onSave: (v: string) => Promise<void>
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  function formatDisplay(v: string) {
    if (!v) return ''
    // Add T12:00:00 to prevent timezone-off-by-one
    const d = new Date(v + 'T12:00:00')
    if (format === 'month-day') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
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
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="text-xs border border-[hsl(213,70%,30%)] rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-card"
          disabled={saving}
        />
        <button
          onClick={commit}
          disabled={saving}
          className="p-0.5 rounded text-emerald-600 hover:bg-emerald-50"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          onClick={() => { setDraft(value ?? ''); setEditing(false) }}
          className="p-0.5 rounded text-muted-foreground hover:bg-muted"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  if (!value) {
    return (
      <button
        onClick={() => { setDraft(''); setEditing(true) }}
        title={`Add ${label}`}
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {icon}
        <span>{label}</span>
        <Plus className="h-2.5 w-2.5" />
      </button>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ''); setEditing(true) }}
      title={`Edit ${label}`}
      className="group inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted transition-colors"
    >
      {icon}
      <span>{formatDisplay(value)}</span>
      <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40 transition-opacity" />
    </button>
  )
}

// ── Quick Notes Accordion ─────────────────────────────────────────────────────

function QuickNotesAccordion({
  personId,
  initialValue,
  onSave,
}: {
  personId: string
  initialValue: string
  onSave: (v: string) => Promise<void>
}) {
  const draftKey = `qn-draft-${personId}`
  const isEmpty = !initialValue.trim()
  const [isOpen, setIsOpen] = useState(isEmpty) // start open when empty
  const [draft, setDraft] = useState(initialValue)
  const [savedValue, setSavedValue] = useState(initialValue)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const hasChanges = draft !== savedValue

  // Restore any unsaved draft from localStorage on mount
  useEffect(() => {
    const stored = loadDraft(draftKey)
    if (stored !== null && stored !== initialValue) {
      setDraft(stored)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft to localStorage while the user is typing
  useDraftSave(draftKey, draft, hasChanges)

  function handleSaveAttempt() {
    if (!hasChanges) return
    // If overwriting existing non-empty content, ask first
    if (savedValue.trim()) {
      setConfirmOpen(true)
    } else {
      void doSave()
    }
  }

  async function doSave() {
    setSaving(true)
    await onSave(draft)
    clearDraft(draftKey)
    setSavedValue(draft)
    setSaving(false)
    setConfirmOpen(false)
  }

  return (
    <div className="border-b border-border">
      {/* Accordion header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quick Notes</span>
        <div className="flex items-center gap-2 min-w-0">
          {!isOpen && savedValue.trim() && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
              {savedValue.slice(0, 28)}{savedValue.length > 28 ? '…' : ''}
            </span>
          )}
          {isOpen
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          }
        </div>
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add quick notes about this person…"
            rows={4}
            className="w-full text-sm border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-card resize-none text-foreground placeholder:text-muted-foreground"
          />
          {hasChanges && (
            <button
              onClick={handleSaveAttempt}
              disabled={saving}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium disabled:opacity-50 hover:bg-[hsl(213,70%,25%)] transition-colors"
            >
              <Check className="h-3 w-3" />
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          )}
        </div>
      )}

      {/* Confirm overwrite dialog */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!v && !saving) setConfirmOpen(false) }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Save Quick Notes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will overwrite the existing notes. Are you sure?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={doSave} disabled={saving}>
              {saving ? 'Saving…' : 'Yes, Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Compact relationships section ─────────────────────────────────────────────

function CompactRCNote({
  rcId,
  subjectPersonId,
  initialNote,
}: {
  rcId: string
  subjectPersonId: string
  initialNote: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialNote)
  const [saved, setSaved] = useState(initialNote)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (draft === saved) { setOpen(false); return }
    setSaving(true)
    const result = await upsertRCNoteAction({ rcId, subjectPersonId, content: draft })
    setSaving(false)
    if (!('error' in result) || !result.error) {
      setSaved(draft)
      setOpen(false)
    }
  }

  function handleCancel() {
    setDraft(saved)
    setOpen(false)
  }

  return (
    <>
      <div className="mt-0.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Quick Notes</p>
        {saved ? (
          <button onClick={() => { setDraft(saved); setOpen(true) }} className="w-full text-left" title="View or edit">
            <p className="text-[11px] text-muted-foreground line-clamp-2 hover:text-foreground transition-colors">{saved}</p>
          </button>
        ) : (
          <button onClick={() => { setDraft(''); setOpen(true) }} className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            <StickyNote className="h-2.5 w-2.5" />
            Add note
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) handleCancel() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Notes</DialogTitle>
          </DialogHeader>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            disabled={saving}
            rows={8}
            placeholder="Add a quick note about this relationship…"
            className="w-full text-sm text-foreground border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)] focus:border-transparent disabled:opacity-50"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <p className="text-xs text-muted-foreground">⌘↵ to save</p>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CompactRelationshipsSection({
  relationships,
  subjectPersonId,
  subjectName,
  allPeople,
  canEdit,
  rcNotes = new Map(),
}: {
  relationships: RelationshipContext[]
  subjectPersonId: string
  subjectName: string
  allPeople: { id: string; name: string }[]
  canEdit: boolean
  rcNotes?: Map<string, Note>
}) {
  const classified = relationships
    .map((rc) => classifyRelationship(rc, subjectPersonId))
    .filter((b): b is BucketItem => b !== null)

  const roleOrder: Array<{ key: BucketItem['role']; label: string }> = [
    { key: 'coachee',  label: 'Coachee' },
    { key: 'manager',  label: 'Reports to' },
    { key: 'report',   label: 'Direct Report' },
    { key: 'client',   label: 'Client' },
    { key: 'prospect', label: 'Prospect' },
    { key: 'peer',     label: 'Peer' },
    { key: 'personal', label: 'Personal' },
  ]

  const groups = roleOrder
    .map(({ key, label }) => ({
      label,
      items: classified.filter((b) => b.role === key),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No relationships logged yet.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {label}
              </p>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.rc.id} className="flex items-start gap-2 py-0.5">
                    <div className="w-5 h-5 rounded-full bg-muted flex-shrink-0 flex items-center justify-center mt-0.5">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase">
                        {item.otherName[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-foreground truncate">{item.otherName}</span>
                        {canEdit && (
                          <RelationshipDialog
                            mode="edit"
                            rcId={item.rc.id}
                            subjectPersonId={subjectPersonId}
                            subjectName={subjectName}
                            otherPersonId={item.otherPersonId}
                            otherName={item.otherName}
                            initialRole={
                              item.role === 'client' ? 'client_of' :
                              item.role === 'prospect' ? 'prospect_of' :
                              item.role
                            }
                            initialStartDate={item.rc.startDate}
                            initialStatus={item.rc.status as 'Active' | 'Inactive' | 'Paused' | 'Ended'}
                            trigger={
                              <button
                                className="p-0.5 rounded text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                                aria-label="Edit relationship"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            }
                          />
                        )}
                      </div>
                      {item.otherTitle && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.otherTitle}</p>
                      )}
                      <CompactRCNote
                        rcId={item.rc.id}
                        subjectPersonId={item.otherPersonId}
                        initialNote={rcNotes.get(item.rc.id)?.content ?? ''}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <RelationshipDialog
          mode="add"
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          people={allPeople}
          trigger={
            <button className="flex items-center gap-1 text-xs text-[hsl(213,70%,35%)] hover:text-[hsl(213,70%,25%)] font-medium transition-colors">
              <Plus className="h-3 w-3" />
              Add relationship
            </button>
          }
        />
      )}
    </div>
  )
}

// ── Inline text field ─────────────────────────────────────────────────────────

function InlineText({
  label,
  value,
  placeholder = 'Not set',
  onSave,
  multiline = false,
}: {
  label: string
  value: string
  placeholder?: string
  onSave: (v: string) => Promise<void>
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  async function commit() {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  function cancel() { setDraft(value); setEditing(false) }

  if (editing) {
    const sharedClass =
      'w-full text-sm border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-card resize-none'
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className={sharedClass}
            disabled={saving}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
            className={sharedClass}
            disabled={saving}
          />
        )}
        <div className="flex gap-1.5">
          <button
            onClick={commit}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={cancel}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-muted-foreground text-xs"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="w-full text-left group space-y-0.5"
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-sm flex items-center gap-1.5 ${value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
        {value || placeholder}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
      </p>
    </button>
  )
}

// ── Inline linked-record select ───────────────────────────────────────────────

function InlineSelect({
  label,
  currentId,
  currentLabel,
  options,
  onSave,
  placeholder = 'Not set',
  valueClassName,
}: {
  label?: string
  currentId: string | undefined
  currentLabel: string | undefined
  options: ProfileOption[]
  onSave: (id: string | null) => Promise<void>
  placeholder?: string
  valueClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    setSaving(true)
    await onSave(val === '' ? null : val)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-1">
        {label && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>}
        <div className="flex gap-1.5 items-center">
          <select
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            defaultValue={currentId ?? ''}
            onChange={handleChange}
            disabled={saving}
            className="flex-1 text-sm border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 bg-card focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
          >
            <option value="">— Clear —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button
            onClick={() => setEditing(false)}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-left group space-y-0.5">
      {label && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>}
      <p className={`text-sm flex items-center gap-1.5 ${currentLabel ? (valueClassName ?? 'text-foreground') : 'text-muted-foreground italic'}`}>
        {currentLabel || placeholder}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
      </p>
    </button>
  )
}

// ── Personality attribute card ────────────────────────────────────────────────

function PersonalityCard({
  label,
  bg,
  border,
  children,
}: {
  label: string
  bg: string
  border: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <div className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${bg} ${border}`}>
        {children}
      </div>
    </div>
  )
}


// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-4 pt-4 pb-1.5">
        {title}
      </p>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </div>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

export default function PersonSidebar({
  person,
  coachContext,
  profileOptions,
  userCanWrite,
  onPersonUpdate,
  relationships = [],
  rcNotes = new Map(),
}: Props) {

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function saveProfile(fields: Parameters<typeof updateProfileAction>[1]) {
    const result = await updateProfileAction(person.id, fields)
    if ('error' in result) console.error('[PersonSidebar] profile save error:', result.error)
    else onPersonUpdate?.(fields as Partial<User>)
  }

  async function saveContext(fields: { quickNotes?: string; familyDetails?: string }) {
    await updateCoachContextAction(person.id, fields)
  }

  // ── Personality option lookups ────────────────────────────────────────────

  const enneagramCurrent = profileOptions.enneagrams.find(
    (o) => person.enneagramIds?.includes(o.id),
  )
  const mbtiCurrent = profileOptions.mbtis.find((o) => person.mbtiIds?.includes(o.id))
  const conflictCurrent = profileOptions.conflictPostures.find(
    (o) => person.conflictPostureIds?.includes(o.id),
  )
  const apologyCurrent = profileOptions.apologyLanguages.find(
    (o) => person.apologyLanguageIds?.includes(o.id),
  )

  const avatar = person.avatarUrl || person.profilePhoto
  const initials = [person.firstName, person.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join('')
    .toUpperCase() || (person.email[0] ?? '?').toUpperCase()

  const displayName =
    person.preferredName ||
    person.fullName ||
    [person.firstName, person.lastName].filter(Boolean).join(' ') ||
    person.email

  const displayTitle = person.jobTitle ?? person.title
  const contactEmail = person.workEmail ?? person.email

  const allPeopleForPicker = profileOptions.allUsers.map((u) => ({ id: u.id, name: u.name }))

  return (
    <div className="divide-y divide-border">

      {/* ── Identity block ──────────────────────────────────────────────── */}
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-[hsl(213,50%,85%)] flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
            {avatar ? (
              <img src={avatar} alt={initials} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold text-[hsl(213,70%,30%)]">{initials}</span>
            )}
          </div>

          {/* Name + details */}
          <div className="flex-1 min-w-0 space-y-0.5">
            {/* Name row */}
            <div className="flex items-start gap-1 min-w-0">
              <p className="text-base font-bold text-foreground leading-snug min-w-0 truncate flex-1">
                {displayName}
              </p>
              {userCanWrite && (
                <EditNameDialog
                  person={person}
                  onSave={async (firstName, lastName, preferredName) => {
                    await saveProfile({ 'First Name': firstName, 'Last Name': lastName, 'Preferred Name': preferredName })
                  }}
                />
              )}
            </div>

            {/* Title (inline editable) */}
            {userCanWrite ? (
              <InlineText
                label=""
                value={displayTitle ?? ''}
                placeholder="Add title…"
                onSave={(v) => saveProfile({ 'Title': v })}
              />
            ) : (
              displayTitle && (
                <p className="text-xs text-muted-foreground">{displayTitle}</p>
              )
            )}

            {/* Company */}
            {person.companyName && (
              <p className="text-xs text-muted-foreground">{person.companyName}</p>
            )}

            {/* Email */}
            {contactEmail && (
              <a
                href={`mailto:${contactEmail}`}
                className="text-xs text-[hsl(213,70%,35%)] hover:underline block truncate"
              >
                {contactEmail}
              </a>
            )}

            {/* Date chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {userCanWrite && (
                <InlineDateField
                  icon={<Cake className="h-3 w-3" />}
                  value={person.birthday}
                  format="month-day"
                  label="Birthday"
                  onSave={(v) => saveProfile({ 'Birthday': v })}
                />
              )}
              {userCanWrite && (
                <InlineDateField
                  icon={<CalendarDays className="h-3 w-3" />}
                  value={person.hireDate}
                  format="month-year"
                  label="Work Anniversary"
                  onSave={(v) => saveProfile({ 'Hire Date': v })}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Notes (accordion) ─────────────────────────────────────── */}
      {userCanWrite && (
        <QuickNotesAccordion
          personId={person.id}
          initialValue={coachContext?.quickNotes ?? ''}
          onSave={(v) => saveContext({ quickNotes: v })}
        />
      )}

      {/* ── Relationships ────────────────────────────────────────────────── */}
      <Section title="Relationships">
        <CompactRelationshipsSection
          relationships={relationships}
          subjectPersonId={person.id}
          subjectName={displayName}
          allPeople={allPeopleForPicker}
          canEdit={userCanWrite}
          rcNotes={rcNotes}
        />
      </Section>

      {/* ── Personality ─────────────────────────────────────────────────── */}
      <Section title="Personality">
        <div className="space-y-3">

          {/* Enneagram — blue */}
          <PersonalityCard label="Enneagram" bg="bg-blue-50 dark:bg-blue-950/40" border="border-blue-100 dark:border-blue-800/50">
            <InlineSelect
              currentId={person.enneagramIds?.[0]}
              currentLabel={enneagramCurrent?.name || person.enneagramType || undefined}
              options={profileOptions.enneagrams}
              placeholder="Not set"
              valueClassName="text-blue-800 dark:text-blue-300 font-semibold"
              onSave={async (id) => { await saveProfile({ 'Enneagram': id ? [id] : [] }) }}
            />
            {(enneagramCurrent?.descriptor || person.enneagramDescriptor) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {enneagramCurrent?.descriptor ?? person.enneagramDescriptor}
              </p>
            )}
          </PersonalityCard>

          {/* 16 Personalities — violet */}
          <PersonalityCard label="16 Personalities" bg="bg-violet-50 dark:bg-violet-950/40" border="border-violet-100 dark:border-violet-800/50">
            <InlineSelect
              currentId={person.mbtiIds?.[0]}
              currentLabel={mbtiCurrent?.name || (person.mbtiType ? person.mbtiType.split('-')[0] : undefined)}
              options={profileOptions.mbtis}
              placeholder="Not set"
              valueClassName="text-violet-800 dark:text-violet-300 font-semibold"
              onSave={async (id) => { await saveProfile({ 'MBTI': id ? [id] : [] }) }}
            />
            {(mbtiCurrent?.descriptor || person.mbtiDescriptor) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mbtiCurrent?.descriptor ?? person.mbtiDescriptor}
              </p>
            )}
          </PersonalityCard>

          {/* Conflict Posture — amber */}
          <PersonalityCard label="Conflict Posture" bg="bg-amber-50 dark:bg-amber-950/40" border="border-amber-100 dark:border-amber-800/50">
            <InlineSelect
              currentId={person.conflictPostureIds?.[0]}
              currentLabel={conflictCurrent?.name || person.conflictPosture || undefined}
              options={profileOptions.conflictPostures}
              placeholder="Not set"
              valueClassName="text-amber-800 dark:text-amber-300 font-semibold"
              onSave={async (id) => { await saveProfile({ 'Conflict Posture': id ? [id] : [] }) }}
            />
            {(conflictCurrent?.descriptor || person.conflictPostureDescriptor) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {conflictCurrent?.descriptor ?? person.conflictPostureDescriptor}
              </p>
            )}
          </PersonalityCard>

          {/* Apology Language — emerald */}
          <PersonalityCard label="Apology Language" bg="bg-emerald-50 dark:bg-emerald-950/40" border="border-emerald-100 dark:border-emerald-800/50">
            <InlineSelect
              currentId={person.apologyLanguageIds?.[0]}
              currentLabel={apologyCurrent?.name || person.apologyLanguage || undefined}
              options={profileOptions.apologyLanguages}
              placeholder="Not set"
              valueClassName="text-emerald-800 dark:text-emerald-300 font-semibold"
              onSave={async (id) => { await saveProfile({ 'Apology Language': id ? [id] : [] }) }}
            />
            {(apologyCurrent?.descriptor || person.apologyLanguageDescriptor) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {apologyCurrent?.descriptor ?? person.apologyLanguageDescriptor}
              </p>
            )}
          </PersonalityCard>

          {/* Clifton Strengths — indigo, full display */}
          {person.strengths && person.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Clifton Strengths
              </p>
              <div className="rounded-lg border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-950/40 px-3 py-2.5">
                <ol className="space-y-2.5">
                  {person.strengths.map((s, i) => {
                    const opt = profileOptions.strengths.find((o) => o.name === s.name)
                    const descriptor = opt?.descriptor
                    return (
                      <li key={i}>
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-700 text-indigo-600 dark:text-indigo-100 text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">{s.name}</span>
                          {s.domain && (
                            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-100 px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-600/60 rounded">
                              {s.domain}
                            </span>
                          )}
                        </div>
                        {descriptor && (
                          <div className="ml-7 mt-0.5">
                            <p className="text-xs text-muted-foreground leading-relaxed">{descriptor}</p>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          )}

        </div>
      </Section>


      {/* ── Family Details ───────────────────────────────────────────────── */}
      {userCanWrite && (
        <Section title="Family Details">
          <InlineText
            label=""
            value={coachContext?.familyDetails ?? ''}
            placeholder="Click to add family details…"
            multiline
            onSave={(v) => saveContext({ familyDetails: v })}
          />
        </Section>
      )}

      <div className="h-6" />
    </div>
  )
}
