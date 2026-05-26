'use client'

import { useState, useRef } from 'react'
import { Check, Pencil, X, Plus, Search } from 'lucide-react'
import {
  updateProfileAction,
  updateCoachContextAction,
  linkExistingTeamMember,
  searchUsersAction,
} from '../actions'
import type { User } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'
import type { ProfileOption } from '@/lib/airtable/users'

interface ProfileOptions {
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  allUsers: ProfileOption[]
}

interface Props {
  person: User
  coachContext: CoachPersonContext | null
  profileOptions: ProfileOptions
  userCanWrite: boolean
  onPersonUpdate?: (partial: Partial<User>) => void
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
      'w-full text-sm border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-white resize-none'
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-xs"
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
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm flex items-center gap-1.5 ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}>
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
}: {
  label: string
  currentId: string | undefined
  currentLabel: string | undefined
  options: ProfileOption[]
  onSave: (id: string | null) => Promise<void>
  placeholder?: string
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
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="flex gap-1.5 items-center">
          <select
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            defaultValue={currentId ?? ''}
            onChange={handleChange}
            disabled={saving}
            className="flex-1 text-sm border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
          >
            <option value="">— Clear —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button onClick={() => setEditing(false)} className="p-1.5 rounded-md border border-slate-200 text-slate-400 hover:bg-slate-50">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {saving && <p className="text-xs text-slate-400">Saving…</p>}
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full text-left group space-y-0.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm flex items-center gap-1.5 ${currentLabel ? 'text-slate-800' : 'text-slate-400 italic'}`}>
        {currentLabel || placeholder}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
      </p>
    </button>
  )
}

// ── Team member row ───────────────────────────────────────────────────────────

function TeamMemberRow({
  name,
  label,
}: {
  name: string
  label?: string
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <div className="w-5 h-5 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center">
        <span className="text-[9px] font-bold text-slate-500 uppercase">{name[0]}</span>
      </div>
      <span className="text-sm text-slate-700 truncate">{name}</span>
      {label && <span className="text-xs text-slate-400 shrink-0">{label}</span>}
    </div>
  )
}

// ── Add team member search ────────────────────────────────────────────────────

function AddTeamMemberInline({
  personId,
  existingIds,
  onAdded,
}: {
  personId: string
  existingIds: string[]
  onAdded: (newId: string, newName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string; jobTitle?: string }>>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState(false)

  async function handleSearch(q: string) {
    setQuery(q)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const res = await searchUsersAction(q)
    setSearching(false)
    setResults(res.filter((r) => !existingIds.includes(r.id)))
  }

  async function handleAdd(result: { id: string; name: string }) {
    setAdding(true)
    const outcome = await linkExistingTeamMember(personId, existingIds, result.id)
    setAdding(false)
    if ('success' in outcome) {
      onAdded(result.id, result.name)
      setOpen(false)
      setQuery('')
      setResults([])
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-[hsl(213,70%,35%)] hover:text-[hsl(213,70%,25%)] mt-1 font-medium"
      >
        <Plus className="h-3 w-3" />
        Add member
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search people…"
          className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-white"
          disabled={adding}
        />
      </div>
      {searching && <p className="text-xs text-slate-400">Searching…</p>}
      {results.length > 0 && (
        <ul className="border border-slate-200 rounded-md bg-white divide-y divide-slate-100 overflow-hidden">
          {results.slice(0, 5).map((r) => (
            <li key={r.id}>
              <button
                onClick={() => handleAdd(r)}
                disabled={adding}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <p className="text-xs font-medium text-slate-800">{r.name}</p>
                {r.jobTitle && <p className="text-xs text-slate-400">{r.jobTitle}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-4 pt-4 pb-1.5">
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
}: Props) {
  // Local copies of the linked name lists (so adding a team member updates instantly)
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>(person.teamMemberIds ?? [])
  const [teamMemberNames, setTeamMemberNames] = useState<string[]>(
    (person.teamMemberIds ?? []).map(
      (id) => profileOptions.allUsers.find((u) => u.id === id)?.name ?? id,
    ),
  )

  const lookupName = (id: string) =>
    profileOptions.allUsers.find((u) => u.id === id)?.name ?? id

  // ── Save helpers ─────────────────────────────────────────────────────────────

  async function saveProfile(fields: Parameters<typeof updateProfileAction>[1]) {
    const result = await updateProfileAction(person.id, fields)
    if ('error' in result) console.error('[PersonSidebar] profile save error:', result.error)
    else onPersonUpdate?.(fields as Partial<User>)
  }

  async function saveContext(fields: { quickNotes?: string; familyDetails?: string }) {
    await updateCoachContextAction(person.id, fields)
  }

  // ── Personality option lookups ────────────────────────────────────────────────

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

  const avatar =
    person.avatarUrl || person.profilePhoto
  const initials = [person.firstName, person.lastName]
    .filter(Boolean)
    .map((n) => n![0])
    .join('')
    .toUpperCase() || (person.email[0] ?? '?').toUpperCase()

  return (
    <div className="divide-y divide-slate-100">

      {/* ── Identity ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-5 flex flex-col items-center text-center gap-2">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-[hsl(213,50%,85%)] flex items-center justify-center overflow-hidden flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt={initials} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-[hsl(213,70%,30%)]">{initials}</span>
          )}
        </div>

        {/* Name — shown as read-only display; edit via fields below */}
        <div>
          <p className="text-base font-bold text-slate-900 leading-snug">
            {person.preferredName ||
              person.fullName ||
              [person.firstName, person.lastName].filter(Boolean).join(' ') ||
              person.email}
          </p>
          {person.companyName && (
            <p className="text-xs text-slate-400 mt-0.5">{person.companyName}</p>
          )}
        </div>
      </div>

      {/* ── Name fields ───────────────────────────────────────────────────── */}
      <Section title="Name">
        <InlineText
          label="First Name"
          value={person.firstName ?? ''}
          onSave={(v) => saveProfile({ 'First Name': v })}
        />
        <InlineText
          label="Last Name"
          value={person.lastName ?? ''}
          onSave={(v) => saveProfile({ 'Last Name': v })}
        />
        <InlineText
          label="Preferred Name"
          value={person.preferredName ?? ''}
          onSave={(v) => saveProfile({ 'Preferred Name': v })}
        />
        <InlineText
          label="Title"
          value={person.title ?? ''}
          onSave={(v) => saveProfile({ 'Title': v })}
        />
      </Section>

      {/* ── Personality ───────────────────────────────────────────────────── */}
      <Section title="Personality">
        <InlineSelect
          label="Enneagram"
          currentId={person.enneagramIds?.[0]}
          currentLabel={
            enneagramCurrent?.name ||
            (person.enneagramType
              ? `${person.enneagramType}${person.enneagramDescriptor ? ` · ${person.enneagramDescriptor}` : ''}`
              : undefined)
          }
          options={profileOptions.enneagrams}
          placeholder="Not set"
          onSave={async (id) => {
            await saveProfile({ 'Enneagram': id ? [id] : [] })
          }}
        />
        <InlineSelect
          label="MBTI"
          currentId={person.mbtiIds?.[0]}
          currentLabel={
            mbtiCurrent?.name ||
            (person.mbtiType
              ? `${person.mbtiType}${person.mbtiDescriptor ? ` · ${person.mbtiDescriptor}` : ''}`
              : undefined)
          }
          options={profileOptions.mbtis}
          placeholder="Not set"
          onSave={async (id) => {
            await saveProfile({ 'MBTI': id ? [id] : [] })
          }}
        />
        <InlineSelect
          label="Conflict Posture"
          currentId={person.conflictPostureIds?.[0]}
          currentLabel={
            conflictCurrent?.name ||
            (person.conflictPosture
              ? `${person.conflictPosture}${person.conflictPostureDescriptor ? ` · ${person.conflictPostureDescriptor}` : ''}`
              : undefined)
          }
          options={profileOptions.conflictPostures}
          placeholder="Not set"
          onSave={async (id) => {
            await saveProfile({ 'Conflict Posture': id ? [id] : [] })
          }}
        />
        <InlineSelect
          label="Apology Language"
          currentId={person.apologyLanguageIds?.[0]}
          currentLabel={
            apologyCurrent?.name ||
            (person.apologyLanguage
              ? `${person.apologyLanguage}${person.apologyLanguageDescriptor ? ` · ${person.apologyLanguageDescriptor}` : ''}`
              : undefined)
          }
          options={profileOptions.apologyLanguages}
          placeholder="Not set"
          onSave={async (id) => {
            await saveProfile({ 'Apology Language': id ? [id] : [] })
          }}
        />

        {/* Strengths — read-only list (complex multi-select) */}
        {person.strengths && person.strengths.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              CliftonStrengths
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {person.strengths.map((s) => (
                <span
                  key={s.name}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Team & Org ────────────────────────────────────────────────────── */}
      <Section title="Team & Org">
        {/* Manager */}
        {person.managerIds?.[0] && (
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Manager</p>
            <TeamMemberRow name={lookupName(person.managerIds[0])} />
          </div>
        )}

        {/* Direct Reports */}
        {person.directReportIds && person.directReportIds.length > 0 && (
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Direct Reports
            </p>
            <div className="space-y-1">
              {person.directReportIds.map((id) => (
                <TeamMemberRow key={id} name={lookupName(id)} />
              ))}
            </div>
          </div>
        )}

        {/* Team Members */}
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Team Members
          </p>
          {teamMemberNames.length > 0 ? (
            <div className="space-y-1">
              {teamMemberNames.map((name, i) => (
                <TeamMemberRow key={teamMemberIds[i]} name={name} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">None added yet</p>
          )}
          {userCanWrite && (
            <AddTeamMemberInline
              personId={person.id}
              existingIds={teamMemberIds}
              onAdded={(newId, newName) => {
                setTeamMemberIds((prev) => [...prev, newId])
                setTeamMemberNames((prev) => [...prev, newName])
              }}
            />
          )}
        </div>
      </Section>

      {/* ── Coaching Context ──────────────────────────────────────────────── */}
      {userCanWrite && (
        <Section title="Coaching Context">
          <InlineText
            label="Quick Notes"
            value={coachContext?.quickNotes ?? ''}
            placeholder="Click to add quick notes…"
            multiline
            onSave={(v) => saveContext({ quickNotes: v })}
          />
          <InlineText
            label="Family Details"
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
