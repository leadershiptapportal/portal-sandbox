'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import SearchCombobox from '@/components/ui/SearchCombobox'
import { createClientAction } from './actions'

interface OrgOption {
  id: string
  name: string
}

interface CoachOption {
  id: string
  name: string
}

interface Props {
  coaches: CoachOption[]
  organizations: OrgOption[]
  currentCoachId?: string
  currentCoachName?: string
}

const AFFILIATION_TYPE_LABELS: Record<string, string> = {
  employee:   'Employee',
  contractor: 'Contractor',
  member:     'Member',
  client:     'Client',
  founder:    'Founder / Owner',
  alum:       'Alum',
  other:      'Other',
}

export default function CreateHumanModal({
  coaches,
  organizations,
  currentCoachId,
  currentCoachName,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Identity ────────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [workEmail, setWorkEmail] = useState('')

  // ── Organization ────────────────────────────────────────────────────────────
  const [orgMode, setOrgMode] = useState<'find' | 'create'>('find')
  const [organizationId, setOrganizationId] = useState('')
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDomain, setNewOrgDomain] = useState('')
  const [jobTitle, setJobTitle] = useState('')

  // ── Coach ───────────────────────────────────────────────────────────────────
  const [coachId, setCoachId] = useState(currentCoachId ?? '')

  function resetForm() {
    setFirstName('')
    setLastName('')
    setWorkEmail('')
    setOrgMode('find')
    setOrganizationId('')
    setNewOrgName('')
    setNewOrgDomain('')
    setJobTitle('')
    setCoachId(currentCoachId ?? '')
    setError('')
  }

  function handleOpen() {
    resetForm()
    setOpen(true)
  }

  // ── Derived preview ─────────────────────────────────────────────────────────
  const orgName = orgMode === 'find'
    ? (organizations.find((o) => o.id === organizationId)?.name ?? null)
    : (newOrgName.trim() || null)
  const resolvedCoachName = coaches.find((c) => c.id === coachId)?.name ?? currentCoachName ?? null

  const willCreate = [
    orgName && `Affiliation with ${orgName}${jobTitle.trim() ? ` (${jobTitle.trim()})` : ''}`,
    coachId && resolvedCoachName && `Coaching relationship with ${resolvedCoachName}`,
  ].filter(Boolean) as string[]

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.')
      return
    }
    if (orgMode === 'create' && !newOrgName.trim()) {
      setError('Organization name is required when adding a new org.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const result = await createClientAction({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workEmail: workEmail.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        organizationId: orgMode === 'find' ? (organizationId || undefined) : undefined,
        newOrg: orgMode === 'create' && newOrgName.trim()
          ? { name: newOrgName.trim(), domain: newOrgDomain.trim() || undefined }
          : undefined,
        coachId: coachId || undefined,
      })
      if (!result.success) {
        setError(result.error ?? 'Failed to create — please try again.')
        setSaving(false)
        return
      }
      setOpen(false)
      if (result.id) {
        router.push(`/myhumans/${result.id}`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen} className="gap-1.5">
        <UserPlus className="h-4 w-4" />
        Add Human
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) setOpen(false) }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Human</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">

            {/* ── Identity ───────────────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identity
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ch-first">First Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="ch-first"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ch-last">Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="ch-last"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ch-email">Work Email</Label>
                <Input
                  id="ch-email"
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="jane@company.com"
                  disabled={saving}
                />
              </div>
            </div>

            {/* ── Organization ───────────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Organization <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
              </p>

              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => setOrgMode('find')}
                  className={`flex-1 py-1.5 font-medium transition-colors ${orgMode === 'find' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  disabled={saving}
                >
                  Find existing
                </button>
                <button
                  type="button"
                  onClick={() => setOrgMode('create')}
                  className={`flex-1 py-1.5 font-medium transition-colors ${orgMode === 'create' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  disabled={saving}
                >
                  Add new
                </button>
              </div>

              {orgMode === 'find' ? (
                <SearchCombobox
                  options={organizations}
                  value={organizationId}
                  onValueChange={setOrganizationId}
                  placeholder="Search organizations…"
                  disabled={saving}
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Organization name *"
                    disabled={saving}
                  />
                  <Input
                    value={newOrgDomain}
                    onChange={(e) => setNewOrgDomain(e.target.value)}
                    placeholder="Domain (optional, e.g. acme.com)"
                    disabled={saving}
                  />
                </div>
              )}

              {(orgMode === 'find' ? organizationId : newOrgName.trim()) && (
                <div className="space-y-1.5">
                  <Label htmlFor="ch-title">Title at Organization</Label>
                  <Input
                    id="ch-title"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. VP of Operations"
                    disabled={saving}
                  />
                </div>
              )}
            </div>

            {/* ── Coach ──────────────────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coach <span className="font-normal normal-case text-muted-foreground/60">(optional)</span>
              </p>
              <SearchCombobox
                options={coaches}
                value={coachId}
                onValueChange={setCoachId}
                placeholder="Search coaches…"
                disabled={saving}
              />
            </div>

            {/* ── Preview ────────────────────────────────────────────────── */}
            {willCreate.length > 0 && firstName.trim() && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20 px-4 py-3 space-y-1">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Will also create
                </p>
                <ul className="space-y-0.5">
                  {willCreate.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-blue-900 dark:text-blue-200">
                      <span className="text-blue-400 flex-shrink-0 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !firstName.trim() || !lastName.trim()}>
              {saving ? 'Creating…' : 'Create Human'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
