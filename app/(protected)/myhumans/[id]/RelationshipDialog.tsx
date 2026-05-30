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
  addRelationshipAction,
  updateRelationshipAction,
  deleteRelationshipAction,
  addRelationshipWithNewPersonAction,
} from './actions'
import type { RelationshipType } from '@/lib/airtable/relationships'

export type RelationshipRole =
  | 'coach'
  | 'coachee'
  | 'manager'
  | 'report'
  | 'client_of'
  | 'prospect_of'
  | 'personal'
  | 'peer'

interface Person {
  id: string
  name: string
}

interface OrgOption {
  id: string
  name: string
}

interface AddProps {
  mode: 'add'
  subjectPersonId: string
  subjectName: string
  people: Person[]
  organizations?: OrgOption[]
  trigger?: React.ReactNode
}

interface EditProps {
  mode: 'edit'
  rcId: string
  subjectPersonId: string
  subjectName: string
  otherPersonId: string
  otherName: string
  initialRole: RelationshipRole
  initialStartDate?: string
  initialStatus?: 'Active' | 'Inactive' | 'Paused' | 'Ended'
  initialOrganizationId?: string
  organizations?: OrgOption[]
  trigger?: React.ReactNode
}

type Props = AddProps | EditProps

// ── role helpers ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<RelationshipRole, string> = {
  coach: 'Coach — someone coaches the subject',
  coachee: 'Coachee — subject coaches them',
  manager: 'Manager — subject reports to them',
  report: 'Direct Report — they report to subject',
  client_of: 'Client — they are subject\'s client',
  prospect_of: 'Prospect — they are a potential client of subject',
  personal: 'Personal — family, partner, or other personal connection',
  peer: 'Peer — colleague or professional equal',
}

function roleToTypeAndDirection(role: RelationshipRole): {
  type: RelationshipType
  subjectIs: 'person' | 'lead'
} {
  switch (role) {
    case 'coach':    return { type: 'coaching',   subjectIs: 'person' }
    case 'coachee':  return { type: 'coaching',   subjectIs: 'lead' }
    case 'manager':  return { type: 'reports_to', subjectIs: 'person' }
    case 'report':   return { type: 'reports_to', subjectIs: 'lead' }
    case 'client_of':  return { type: 'client',   subjectIs: 'lead' }
    case 'prospect_of':return { type: 'prospect', subjectIs: 'lead' }
    case 'personal':   return { type: 'personal', subjectIs: 'lead' }
    case 'peer':       return { type: 'peer',     subjectIs: 'lead' }
  }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function RelationshipDialog(props: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add-mode: toggle between picking an existing person or creating a new one
  const [addMode, setAddMode] = useState<'find' | 'create'>('find')

  // Find-existing state
  const [otherPersonId, setOtherPersonId] = useState('')

  // Create-new state
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  // Shared state
  const [role, setRole] = useState<RelationshipRole>(
    props.mode === 'edit' ? props.initialRole : 'coachee',
  )
  const [startDate, setStartDate] = useState(
    props.mode === 'edit' ? (props.initialStartDate ?? '') : '',
  )
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Paused' | 'Ended'>(
    props.mode === 'edit' ? (props.initialStatus ?? 'Active') : 'Active',
  )
  const [organizationId, setOrganizationId] = useState(
    props.mode === 'edit' ? (props.initialOrganizationId ?? '') : '',
  )

  function handleOpen() {
    if (props.mode === 'add') {
      setAddMode('find')
      setOtherPersonId('')
      setNewFirstName('')
      setNewLastName('')
      setNewEmail('')
      setRole('coachee')
      setStartDate('')
      setStatus('Active')
      setOrganizationId('')
    } else {
      setRole(props.initialRole)
      setStartDate(props.initialStartDate ?? '')
      setStatus(props.initialStatus ?? 'Active')
      setOrganizationId(props.initialOrganizationId ?? '')
    }
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (props.mode === 'add') {
        const { type, subjectIs } = roleToTypeAndDirection(role)
        const role2 = subjectIs === 'person' ? 'subject_is_person' : 'subject_is_lead'

        if (addMode === 'find') {
          if (!otherPersonId) { setError('Pick a person.'); setSaving(false); return }
          const result = await addRelationshipAction({
            subjectPersonId: props.subjectPersonId,
            otherPersonId,
            type,
            role: role2,
            startDate: startDate || undefined,
            organizationId: organizationId || undefined,
          })
          if (!result.success) { setError(result.error ?? 'Failed to add.'); setSaving(false); return }
        } else {
          if (!newFirstName.trim()) { setError('First name is required.'); setSaving(false); return }
          const result = await addRelationshipWithNewPersonAction({
            subjectPersonId: props.subjectPersonId,
            firstName: newFirstName.trim(),
            lastName: newLastName.trim() || undefined,
            email: newEmail.trim() || undefined,
            type,
            role: role2,
            startDate: startDate || undefined,
          })
          if (!result.success) { setError(result.error ?? 'Failed to create.'); setSaving(false); return }
        }

        toast.success('Relationship added')
        setOpen(false)
        await new Promise((r) => setTimeout(r, 400))
        router.refresh()
        return
      }

      // Edit mode
      const { type, subjectIs } = roleToTypeAndDirection(role)
      const humanId = subjectIs === 'person' ? props.subjectPersonId : props.otherPersonId
      const leadId   = subjectIs === 'person' ? props.otherPersonId  : props.subjectPersonId
      const result = await updateRelationshipAction({
        rcId: props.rcId,
        subjectPersonId: props.subjectPersonId,
        fields: { type, status, startDate: startDate || null, humanId, leadId, organizationId: organizationId || null },
      })
      if (!result.success) { setError(result.error ?? 'Failed to update.'); setSaving(false); return }
      toast.success('Relationship updated')
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
    if (!confirm('Remove this relationship? Notes already linked to it stay; only the relationship row is removed.')) return
    setSaving(true)
    try {
      const result = await deleteRelationshipAction({ rcId: props.rcId, subjectPersonId: props.subjectPersonId })
      if (!result.success) { setError(result.error ?? 'Failed to remove.'); setSaving(false); return }
      toast.success('Relationship removed')
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
      Add Relationship
    </Button>
  )

  return (
    <>
      {props.trigger ? <span onClick={handleOpen}>{props.trigger}</span> : triggerEl}

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) setOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {props.mode === 'add' ? 'Add Relationship' : 'Edit Relationship'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            {/* Person selection (add mode only) */}
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
                    Add new person
                  </button>
                </div>

                {addMode === 'find' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="rel-person">
                      Person <span className="text-destructive">*</span>
                    </Label>
                    <Select value={otherPersonId} onValueChange={setOtherPersonId} disabled={saving}>
                      <SelectTrigger id="rel-person">
                        <SelectValue placeholder="Select a person…" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.people
                          .filter((p) => p.id !== props.subjectPersonId)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="new-first">
                          First name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="new-first"
                          value={newFirstName}
                          onChange={(e) => setNewFirstName(e.target.value)}
                          disabled={saving}
                          placeholder="First"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="new-last">Last name</Label>
                        <Input
                          id="new-last"
                          value={newLastName}
                          onChange={(e) => setNewLastName(e.target.value)}
                          disabled={saving}
                          placeholder="Last"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-email">Email (optional)</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={saving}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Other person label (edit mode) */}
            {props.mode === 'edit' && (
              <div className="space-y-1.5">
                <Label>Person</Label>
                <p className="text-sm font-medium text-foreground">{props.otherName}</p>
              </div>
            )}

            {/* Role / relationship type */}
            <div className="space-y-1.5">
              <Label htmlFor="rel-role">Relationship type</Label>
              <Select value={role} onValueChange={(v) => setRole(v as RelationshipRole)} disabled={saving}>
                <SelectTrigger id="rel-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">{ROLE_LABELS.coach}</SelectItem>
                  <SelectItem value="coachee">{ROLE_LABELS.coachee}</SelectItem>
                  <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                  <SelectItem value="report">{ROLE_LABELS.report}</SelectItem>
                  <SelectItem value="client_of">{ROLE_LABELS.client_of}</SelectItem>
                  <SelectItem value="prospect_of">{ROLE_LABELS.prospect_of}</SelectItem>
                  <SelectItem value="personal">{ROLE_LABELS.personal}</SelectItem>
                  <SelectItem value="peer">{ROLE_LABELS.peer}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status (edit mode only) */}
            {props.mode === 'edit' && (
              <div className="space-y-1.5">
                <Label htmlFor="rel-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                  disabled={saving}
                >
                  <SelectTrigger id="rel-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Ended">Ended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Start date */}
            <div className="space-y-1.5">
              <Label htmlFor="rel-start">Start date</Label>
              <Input
                id="rel-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={saving}
              />
            </div>

            {/* Engagement sponsor org — shown when orgs are available */}
            {props.organizations && props.organizations.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="rc-org">Engagement sponsor <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select
                  value={organizationId || 'none'}
                  onValueChange={(v) => setOrganizationId(v === 'none' ? '' : v)}
                  disabled={saving}
                >
                  <SelectTrigger id="rc-org">
                    <SelectValue placeholder="No sponsor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No sponsor</SelectItem>
                    {props.organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
