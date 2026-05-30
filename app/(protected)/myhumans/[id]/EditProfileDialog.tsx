'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import { updateProfileAction, fetchProfileOptionsAction, updateCoachContextAction } from './actions'
import type { HumanProfileFields } from '@/lib/airtable/humans'
import type { Human } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileOption {
  id: string
  name: string
}

interface ProfileOptions {
  organizations: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allHumans: ProfileOption[]
}

interface Props {
  user: Human
  initialQuickNotes?: string | null
  quickNoteRcId?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(user: Human): string {
  if (user.firstName && user.lastName) return (user.firstName[0] + user.lastName[0]).toUpperCase()
  if (user.fullName) {
    const parts = user.fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return user.workEmail?.[0]?.toUpperCase() ?? '?'
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
]
function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 pb-1.5 border-b border-border">
        {title}
      </p>
      {children}
    </div>
  )
}

function Field({ label, children, half }: { label: string; children: React.ReactNode; half?: boolean }) {
  return (
    <div className={half ? '' : 'col-span-2'}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] disabled:bg-muted/50 disabled:text-muted-foreground'

const selectCls =
  'w-full rounded-md border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] bg-card disabled:bg-muted/50 disabled:text-muted-foreground'

function SelectField({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  options: ProfileOption[]
  placeholder: string
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={selectCls}
    >
      <option value="">{loading ? 'Loading…' : placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  )
}

// Role is a display label only. Portal access is controlled by Clerk's
// publicMetadata.role, not this field. Three values mirror the system roles
// documented in CLAUDE.md.
const ROLE_OPTIONS = [
  { value: 'Client', label: 'Person' },
  { value: 'Coach', label: 'Coach' },
  { value: 'Admin', label: 'Admin' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function EditProfileDialog({ user, initialQuickNotes, quickNoteRcId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'uploading' | 'saving' | ''>('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saved, setSaved] = useState(false)

  const [options, setOptions] = useState<ProfileOptions | null>(null)
  const [optionsLoading, setOptionsLoading] = useState(false)

  // ── Photo ────────────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // ── Basic Info ───────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [title, setTitle] = useState('')
  const [workEmail, setWorkEmail] = useState('')

  // ── Personal Info ─────────────────────────────────────────────────────────────
  const [birthday, setBirthday] = useState('')
  const [startDate, setStartDate] = useState('')

  // ── Organization ─────────────────────────────────────────────────────────────
  // Coach and Team Lead removed — those relationships are now managed via the
  // RelationshipsSection on the profile page, which writes to the canonical
  // Relationship Contexts table.
  const [organizationId, setOrganizationId] = useState('')
  const [role, setRole] = useState('')

  // ── Contact ───────────────────────────────────────────────────────────────────
  const [workCellNumber, setWorkCellNumber] = useState('')
  const [personalCellNumber, setPersonalCellNumber] = useState('')

  // ── Quick Notes ───────────────────────────────────────────────────────────────
  const [quickNotes, setQuickNotes] = useState('')

  // ── Personality ──────────────────────────────────────────────────────────────
  const [enneagramId, setEnneagramId] = useState('')
  const [mbtiId, setMbtiId] = useState('')
  const [conflictPostureId, setConflictPostureId] = useState('')
  const [apologyLanguageId, setApologyLanguageId] = useState('')
  const [selectedStrengthIds, setSelectedStrengthIds] = useState<string[]>([])
  const [strengthSearch, setStrengthSearch] = useState('')

  // ── Reset form ───────────────────────────────────────────────────────────────

  function resetForm() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setPhotoPreview(null)
    setSelectedFile(null)
    setFirstName(user.firstName ?? '')
    setLastName(user.lastName ?? '')
    setPreferredName(user.preferredName ?? '')
    setTitle(user.title ?? '')
    setWorkEmail(user.workEmail ?? '')
    setBirthday(user.birthday ?? '')
    setStartDate(user.startDate ?? '')
    setOrganizationId(user.organizationLinkedIds?.[0] ?? '')
    setRole(user.role ?? '')
    setWorkCellNumber(user.workCellNumber ?? '')
    setPersonalCellNumber(user.personalCellNumber ?? '')
    setQuickNotes(initialQuickNotes ?? '')
    setEnneagramId(user.enneagramIds?.[0] ?? '')
    setMbtiId(user.mbtiIds?.[0] ?? '')
    setConflictPostureId(user.conflictPostureIds?.[0] ?? '')
    setApologyLanguageId(user.apologyLanguageIds?.[0] ?? '')
    setSelectedStrengthIds(user.strengthIds ?? [])
    setStrengthSearch('')
    setErrorMsg('')
    setSaved(false)
  }

  // ── Open ─────────────────────────────────────────────────────────────────────

  async function handleOpen() {
    resetForm()
    setOpen(true)
    if (!options) {
      setOptionsLoading(true)
      try {
        const data = await fetchProfileOptionsAction()
        setOptions(data)
      } catch (e) {
        console.error('[EditProfileDialog] fetchProfileOptionsAction failed:', e)
      } finally {
        setOptionsLoading(false)
      }
    }
  }

  useEffect(() => { setOptions(null) }, [user.id])

  // ── Photo picker ─────────────────────────────────────────────────────────────

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke previous blob URL to avoid memory leaks
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(file)
    blobUrlRef.current = url
    setPhotoPreview(url)
    setSelectedFile(file)
    // Reset input so the same file can be re-selected if needed
    e.target.value = ''
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    setErrorMsg('')
    setSaved(false)
    setSaving(true)

    // ── Phase 1: upload photo if a new file was selected ─────────────────────
    if (selectedFile) {
      setSaveStatus('uploading')
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('userId', user.id)
      try {
        const uploadRes = await fetch('/api/upload-photo', { method: 'POST', body: fd })
        const photoResult = await uploadRes.json()
        if (!photoResult.success) {
          setErrorMsg(`Photo upload failed: ${photoResult.error}`)
        } else {
          setSelectedFile(null)
        }
      } catch (err) {
        setErrorMsg(`Photo upload error: ${String(err)}`)
      }
    }

    // ── Phase 2: PATCH changed profile fields ─────────────────────────────────
    setSaveStatus('saving')

    const patch: HumanProfileFields = {}

    // Text fields — only include if changed
    if (firstName !== (user.firstName ?? '')) patch['First Name'] = firstName
    if (lastName !== (user.lastName ?? '')) patch['Last Name'] = lastName
    if (preferredName !== (user.preferredName ?? '')) patch['Preferred Name'] = preferredName
    if (title !== (user.title ?? '')) patch['Title'] = title
    if (workEmail !== (user.workEmail ?? '')) patch['Work Email'] = workEmail
    if (birthday !== (user.birthday ?? '')) patch['Birthday'] = birthday
    if (startDate !== (user.startDate ?? '')) patch['Start Date'] = startDate
    if (workCellNumber !== (user.workCellNumber ?? '')) patch['Work Cell Number'] = workCellNumber
    if (personalCellNumber !== (user.personalCellNumber ?? '')) patch['Personal Cell Number'] = personalCellNumber
    if (role !== (user.role ?? '')) patch['Role'] = role

    // Linked single-record fields — only if changed and non-empty
    if (organizationId && organizationId !== (user.organizationLinkedIds?.[0] ?? '')) patch['Organization'] = [organizationId]
    if (enneagramId && enneagramId !== (user.enneagramIds?.[0] ?? '')) patch['Enneagram'] = [enneagramId]
    if (mbtiId && mbtiId !== (user.mbtiIds?.[0] ?? '')) patch['MBTI'] = [mbtiId]
    if (conflictPostureId && conflictPostureId !== (user.conflictPostureIds?.[0] ?? '')) patch['Conflict Posture'] = [conflictPostureId]
    if (apologyLanguageId && apologyLanguageId !== (user.apologyLanguageIds?.[0] ?? '')) patch['Apology Language'] = [apologyLanguageId]

    // Strengths — include if changed and non-empty
    const origStrengths = [...(user.strengthIds ?? [])].sort().join(',')
    const newStrengths = [...selectedStrengthIds].sort().join(',')
    if (selectedStrengthIds.length > 0 && newStrengths !== origStrengths) {
      patch['Strengths'] = selectedStrengthIds
    }

    if (Object.keys(patch).length > 0) {
      const result = await updateProfileAction(user.id, patch)
      if ('error' in result) {
        setSaving(false)
        setSaveStatus('')
        // Append to any existing photo error rather than overwriting it
        setErrorMsg((prev) => (prev ? `${prev}\n${result.error}` : result.error))
        return
      }
    }

    if (quickNotes !== (initialQuickNotes ?? '') && quickNoteRcId) {
      await updateCoachContextAction(user.id, quickNoteRcId, quickNotes)
    }

    setSaving(false)
    setSaveStatus('')
    setSaved(true)
    router.refresh()
    setTimeout(() => setOpen(false), 1500)
  }

  // ── Strength toggle ──────────────────────────────────────────────────────────

  function toggleStrength(id: string) {
    setSelectedStrengthIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const currentPhoto = photoPreview ?? user.profilePhoto ?? null

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
      >
        Edit Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h2 className="text-lg font-semibold text-foreground">Edit Profile</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-muted-foreground text-2xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-muted">
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* ── Section 1: Profile Photo ────────────────────────────── */}
              <Section title="Profile Photo">
                <div className="flex items-center gap-4">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="Profile" className="w-20 h-20 rounded-full object-cover flex-shrink-0 ring-2 ring-slate-100" />
                  ) : (
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold flex-shrink-0 ${avatarColor(user.id)}`}>
                      {getInitials(user)}
                    </div>
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG or WebP · Max 5 MB</p>
                    <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handlePhotoSelect} className="hidden" />
                  </div>
                </div>
              </Section>

              {/* ── Section 2: Basic Info ───────────────────────────────── */}
              <Section title="Basic Info">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" half><input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" disabled={saving} /></Field>
                  <Field label="Last Name" half><input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" disabled={saving} /></Field>
                  <Field label="Preferred Name" half><input className={inputCls} value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="e.g. Jay" disabled={saving} /></Field>
                  <Field label="Title" half><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP of Operations" disabled={saving} /></Field>
                  <Field label="Work Email"><input className={inputCls} type="email" value={workEmail} onChange={(e) => setWorkEmail(e.target.value)} placeholder="jane@company.com" disabled={saving} /></Field>
                </div>
              </Section>

              {/* ── Section 3: Personal Info ────────────────────────────── */}
              <Section title="Personal Info">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Birthday" half>
                    <input className={inputCls} type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} disabled={saving} />
                  </Field>
                  <Field label="Start Date" half>
                    <input className={inputCls} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={saving} />
                  </Field>
                </div>
              </Section>

              {/* ── Section 4: Organization ─────────────────────────────── */}
              <Section title="Organization">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Organization" half>
                    <SelectField value={organizationId} onChange={setOrganizationId} options={options?.organizations ?? []} placeholder="Select organization…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Role" half>
                    <select value={role} onChange={(e) => setRole(e.target.value)} disabled={saving} className={selectCls}>
                      <option value="">Select role…</option>
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Coach and reporting relationships are managed in the Relationships section on this profile.
                </p>
              </Section>

              {/* ── Section 5: Contact ───────────────────────────────────── */}
              <Section title="Contact">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Work Cell Number" half>
                    <input className={inputCls} type="tel" value={workCellNumber} onChange={(e) => setWorkCellNumber(e.target.value)} placeholder="+1 555 000 0000" disabled={saving} />
                  </Field>
                  <Field label="Personal Cell Number" half>
                    <input className={inputCls} type="tel" value={personalCellNumber} onChange={(e) => setPersonalCellNumber(e.target.value)} placeholder="+1 555 000 0000" disabled={saving} />
                  </Field>
                </div>
              </Section>

              {/* ── Section 6: Quick Notes ───────────────────────────────── */}
              <Section title="Quick Notes">
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={4}
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="Add quick notes about this person…"
                  disabled={saving}
                />
              </Section>

              {/* ── Section 7: Personality & Strengths ──────────────────── */}
              <Section title="Personality & Strengths">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <Field label="Enneagram" half>
                    <SelectField value={enneagramId} onChange={setEnneagramId} options={options?.enneagrams ?? []} placeholder="Select type…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="MBTI" half>
                    <SelectField value={mbtiId} onChange={setMbtiId} options={options?.mbtis ?? []} placeholder="Select type…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Conflict Posture" half>
                    <SelectField value={conflictPostureId} onChange={setConflictPostureId} options={options?.conflictPostures ?? []} placeholder="Select posture…" disabled={saving} loading={optionsLoading} />
                  </Field>
                  <Field label="Apology Language" half>
                    <SelectField value={apologyLanguageId} onChange={setApologyLanguageId} options={options?.apologyLanguages ?? []} placeholder="Select language…" disabled={saving} loading={optionsLoading} />
                  </Field>
                </div>

                <Field label={`Strengths (${selectedStrengthIds.length}/5 selected)`}>
                  {optionsLoading ? (
                    <p className="text-xs text-muted-foreground py-2">Loading strengths…</p>
                  ) : (options?.strengths.length ?? 0) > 0 ? (
                    <div>
                      <input
                        className={`${inputCls} mb-2`}
                        placeholder="Filter strengths…"
                        value={strengthSearch}
                        onChange={(e) => setStrengthSearch(e.target.value)}
                      />
                      <div className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
                        {(options?.strengths ?? [])
                          .filter((s) => !strengthSearch || s.name.toLowerCase().includes(strengthSearch.toLowerCase()))
                          .map((s) => {
                            const checked = selectedStrengthIds.includes(s.id)
                            const atLimit = !checked && selectedStrengthIds.length >= 5
                            return (
                              <label
                                key={s.id}
                                className={`flex items-center gap-2.5 px-3 py-2 text-sm select-none ${atLimit ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-muted/50'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={atLimit || saving}
                                  onChange={() => toggleStrength(s.id)}
                                  className="rounded border-border"
                                />
                                {s.name}
                              </label>
                            )
                          })}
                      </div>
                      {selectedStrengthIds.length >= 5 && (
                        <p className="text-xs text-amber-600 mt-1.5">Maximum of 5 strengths selected.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic py-2">No strengths data available.</p>
                  )}
                </Field>
              </Section>

            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-border flex-shrink-0">
              <div className="mr-auto min-w-0">
                {saved && <p className="text-xs font-medium text-emerald-600">Profile updated ✓</p>}
                {errorMsg && <p className="text-xs font-medium text-rose-600 line-clamp-2">{errorMsg}</p>}
              </div>
              <button onClick={() => setOpen(false)} disabled={saving} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[hsl(213,70%,30%)] text-white rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors font-medium min-w-[130px]">
                {saveStatus === 'uploading' ? 'Uploading photo…' : saveStatus === 'saving' ? 'Saving profile…' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
