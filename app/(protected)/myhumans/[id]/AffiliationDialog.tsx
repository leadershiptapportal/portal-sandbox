'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import {
  addAffiliationAction,
  addAffiliationWithNewOrgAction,
  updateAffiliationAction,
  deleteAffiliationAction,
} from './actions'
import type { AffiliationType, AffiliationStatus } from '@/lib/types'

interface OrgOption {
  id: string
  name: string
}

interface AddProps {
  mode: 'add'
  subjectHumanId: string
  organizations: OrgOption[]
  trigger?: React.ReactNode
}

interface EditProps {
  mode: 'edit'
  affiliationId: string
  subjectHumanId: string
  orgName: string
  initialType: AffiliationType
  initialStatus: AffiliationStatus
  initialStartDate?: string
  initialEndDate?: string
  initialTitleAtOrg?: string
  initialPrimary: boolean
  trigger?: React.ReactNode
}

type Props = AddProps | EditProps

const TYPE_LABELS: Record<AffiliationType, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  member: 'Member — board, volunteer, etc.',
  client: 'Client',
  founder: 'Founder / Owner',
  alum: 'Alum — former member',
  other: 'Other',
}

const ORG_TYPE_LABELS: Record<string, string> = {
  internal_company: 'Internal company',
  client_company: 'Client company',
  partner: 'Partner',
}

export default function AffiliationDialog(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add-mode: toggle between picking an existing org or creating a new one
  const [addMode, setAddMode] = useState<'find' | 'create'>('find')

  // Find-existing state
  const [organizationId, setOrganizationId] = useState('')

  // Create-new-org state
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgDomain, setNewOrgDomain] = useState('')
  const [newOrgType, setNewOrgType] = useState('')

  // Shared affiliation fields
  const [type, setType] = useState<AffiliationType>(
    props.mode === 'edit' ? props.initialType : 'employee',
  )
  const [status, setStatus] = useState<AffiliationStatus>(
    props.mode === 'edit' ? props.initialStatus : 'Active',
  )
  const [titleAtOrg, setTitleAtOrg] = useState(
    props.mode === 'edit' ? (props.initialTitleAtOrg ?? '') : '',
  )
  const [startDate, setStartDate] = useState(
    props.mode === 'edit' ? (props.initialStartDate ?? '') : '',
  )
  const [endDate, setEndDate] = useState(
    props.mode === 'edit' ? (props.initialEndDate ?? '') : '',
  )
  const [primary, setPrimary] = useState(props.mode === 'edit' ? props.initialPrimary : false)

  function handleOpen() {
    if (props.mode === 'add') {
      setAddMode('find')
      setOrganizationId('')
      setNewOrgName('')
      setNewOrgDomain('')
      setNewOrgType('')
      setType('employee')
      setStatus('Active')
      setTitleAtOrg('')
      setStartDate('')
      setEndDate('')
      setPrimary(false)
    } else {
      setType(props.initialType)
      setStatus(props.initialStatus)
      setTitleAtOrg(props.initialTitleAtOrg ?? '')
      setStartDate(props.initialStartDate ?? '')
      setEndDate(props.initialEndDate ?? '')
      setPrimary(props.initialPrimary)
    }
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (props.mode === 'add') {
        if (addMode === 'find') {
          if (!organizationId) { setError('Pick an organization.'); setSaving(false); return }
          const result = await addAffiliationAction({
            subjectHumanId: props.subjectHumanId,
            organizationId,
            type,
            status,
            startDate: startDate || undefined,
            titleAtOrg: titleAtOrg.trim() || undefined,
            primary,
          })
          if (!result.success) { setError(result.error ?? 'Failed to add.'); setSaving(false); return }
        } else {
          if (!newOrgName.trim()) { setError('Organization name is required.'); setSaving(false); return }
          const result = await addAffiliationWithNewOrgAction({
            subjectHumanId: props.subjectHumanId,
            orgName: newOrgName.trim(),
            orgDomain: newOrgDomain.trim() || undefined,
            orgType: newOrgType || undefined,
            type,
            status,
            startDate: startDate || undefined,
            titleAtOrg: titleAtOrg.trim() || undefined,
            primary,
          })
          if (!result.success) { setError(result.error ?? 'Failed to create.'); setSaving(false); return }
        }

        toast.success('Organization added')
        setOpen(false)
        await new Promise((r) => setTimeout(r, 400))
        router.refresh()
        return
      }

      // Edit mode
      const result = await updateAffiliationAction({
        affiliationId: props.affiliationId,
        subjectHumanId: props.subjectHumanId,
        fields: {
          type,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          titleAtOrg: titleAtOrg.trim() || null,
          primary,
        },
      })
      if (!result.success) { setError(result.error ?? 'Failed to update.'); setSaving(false); return }
      toast.success('Organization updated')
      setOpen(false)
      await new Promise((r) => setTimeout(r, 400))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (props.mode !== 'edit') return
    if (!confirm('Remove this organization affiliation? The organization record itself is not deleted.')) return
    setSaving(true)
    try {
      const result = await deleteAffiliationAction({
        affiliationId: props.affiliationId,
        subjectHumanId: props.subjectHumanId,
      })
      if (!result.success) { setError(result.error ?? 'Failed to remove.'); setSaving(false); return }
      toast.success('Organization removed')
      setOpen(false)
      await new Promise((r) => setTimeout(r, 400))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const triggerEl = props.trigger ?? (
    <Button variant="outline" size="sm" onClick={handleOpen}>
      <Plus className="h-4 w-4" />
      Add Organization
    </Button>
  )

  return (
    <>
      {props.trigger ? <span onClick={handleOpen}>{props.trigger}</span> : triggerEl}

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) setOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {props.mode === 'add' ? 'Add Organization' : 'Edit Organization'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* Organization selection (add mode only) */}
            {props.mode === 'add' && (
              <>
                {/* Toggle find / create */}
                <div className="flex rounded-md border border-border overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setAddMode('find')}
                    className={`flex-1 py-1.5 font-medium transition-colors ${addMode === 'find' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Find existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode('create')}
                    className={`flex-1 py-1.5 font-medium transition-colors ${addMode === 'create' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    Add new organization
                  </button>
                </div>

                {addMode === 'find' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="aff-org">
                      Organization <span className="text-destructive">*</span>
                    </Label>
                    <Select value={organizationId} onValueChange={setOrganizationId} disabled={saving}>
                      <SelectTrigger id="aff-org">
                        <SelectValue placeholder="Select an organization…" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.organizations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-org-name">
                        Organization name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="new-org-name"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        disabled={saving}
                        placeholder="e.g. Acme Corp"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-org-domain">Domain (optional)</Label>
                      <Input
                        id="new-org-domain"
                        value={newOrgDomain}
                        onChange={(e) => setNewOrgDomain(e.target.value)}
                        disabled={saving}
                        placeholder="acme.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-org-type">Organization type (optional)</Label>
                      <Select value={newOrgType} onValueChange={setNewOrgType} disabled={saving}>
                        <SelectTrigger id="new-org-type">
                          <SelectValue placeholder="Select type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Org name (edit mode) */}
            {props.mode === 'edit' && (
              <div className="space-y-1.5">
                <Label>Organization</Label>
                <p className="text-sm font-medium text-foreground">{props.orgName}</p>
              </div>
            )}

            {/* Affiliation type */}
            <div className="space-y-1.5">
              <Label htmlFor="aff-type">Affiliation type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AffiliationType)} disabled={saving}>
                <SelectTrigger id="aff-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as AffiliationType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title at org */}
            <div className="space-y-1.5">
              <Label htmlFor="aff-title">Title at organization</Label>
              <Input
                id="aff-title"
                value={titleAtOrg}
                onChange={(e) => setTitleAtOrg(e.target.value)}
                disabled={saving}
                placeholder="e.g. VP of Operations"
              />
            </div>

            {/* Status (edit mode only) */}
            {props.mode === 'edit' && (
              <div className="space-y-1.5">
                <Label htmlFor="aff-status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AffiliationStatus)} disabled={saving}>
                  <SelectTrigger id="aff-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aff-start">Start date</Label>
                <Input
                  id="aff-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              {props.mode === 'edit' && (
                <div className="space-y-1.5">
                  <Label htmlFor="aff-end">End date</Label>
                  <Input
                    id="aff-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={saving}
                  />
                </div>
              )}
            </div>

            {/* Primary */}
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={primary}
                onChange={(e) => setPrimary(e.target.checked)}
                disabled={saving}
                className="h-4 w-4 rounded border-border"
              />
              Primary organization (shown on the profile card)
            </label>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            {props.mode === 'edit' && (
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={saving}
                className="mr-auto text-rose-600 hover:text-rose-700"
              >
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : props.mode === 'add' ? 'Add' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
