'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserPlus, X } from 'lucide-react'
import { createClientAction } from './actions'

interface Coach {
  id: string
  name: string
}

interface Organization {
  id: string
  name: string
}

interface Props {
  coaches: Coach[]
  organizations: Organization[]
  currentCoachId?: string
}

export default function AddHumanDialog({ coaches, organizations, currentCoachId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [orgMode, setOrgMode] = useState<'find' | 'create'>('find')
  const [organizationId, setOrganizationId] = useState('')
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDomain, setNewOrgDomain] = useState('')
  const [coachId, setCoachId] = useState(currentCoachId ?? '')

  function openDialog() {
    setFirstName('')
    setLastName('')
    setWorkEmail('')
    setJobTitle('')
    setOrgMode('find')
    setOrganizationId('')
    setNewOrgName('')
    setNewOrgDomain('')
    setCoachId(currentCoachId ?? '')
    setError('')
    setToast('')
    setOpen(true)
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim() || !workEmail.trim()) {
      setError('First name, last name, and work email are required.')
      return
    }
    setError('')
    setSaving(true)
    const result = await createClientAction({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      workEmail: workEmail.trim(),
      jobTitle: jobTitle.trim() || undefined,
      organizationId: orgMode === 'find' ? (organizationId || undefined) : undefined,
      newOrg: orgMode === 'create' && newOrgName.trim()
        ? { name: newOrgName.trim(), domain: newOrgDomain.trim() || undefined }
        : undefined,
      coachId: coachId || undefined,
    })
    setSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Failed to create human — please try again.')
      return
    }
    setOpen(false)
    if (result.id) {
      router.push(`/myhumans/${result.id}`)
    } else {
      router.refresh()
    }
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Add Human
      </button>

      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !saving && setOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-card rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Add New Human</h2>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">First Name *</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Last Name *</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Work Email *</label>
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="jane@company.com"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Job Title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. VP of Operations"
                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
              />
            </div>

            {/* Organization: find existing or create new */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Organization</label>
              <div className="flex rounded-md border border-border overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setOrgMode('find')}
                  className={`flex-1 py-1.5 font-medium transition-colors ${orgMode === 'find' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Find existing
                </button>
                <button
                  type="button"
                  onClick={() => setOrgMode('create')}
                  className={`flex-1 py-1.5 font-medium transition-colors ${orgMode === 'create' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Add new
                </button>
              </div>
              {orgMode === 'find' ? (
                <select
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-card"
                >
                  <option value="">No organization</option>
                  {organizations.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <input
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Organization name *"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
                  />
                  <input
                    value={newOrgDomain}
                    onChange={(e) => setNewOrgDomain(e.target.value)}
                    placeholder="Domain (optional, e.g. acme.com)"
                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
                  />
                </div>
              )}
            </div>

            {coaches.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Assign Coach</label>
                <select
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] bg-card"
                >
                  <option value="">No coach</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[hsl(213,70%,30%)] text-white text-sm font-medium rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Creating…' : 'Create Human'}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
