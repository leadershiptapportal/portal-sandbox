'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { logManualSessionAction } from '@/app/(protected)/users/[id]/actions'

// Types that have a duration (synchronous interactions)
const SYNC_TYPES = ['In-Person', 'Phone Call', 'Video Call']

const INTERACTION_TYPES = [
  'In-Person',
  'Phone Call',
  'Video Call',
  'Text',
  'Email',
  'Mail',
  'Other',
] as const

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
]

interface Client {
  id: string
  name: string
}

interface Props {
  /** Pre-set person — hides the person picker (use from profile page) */
  defaultPersonId?: string
  /** Shown in the person picker (use from dashboard) */
  clients?: Client[]
  /** Custom trigger element; if omitted a default button is rendered */
  trigger?: React.ReactNode
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function roundedTimeStr() {
  const now = new Date()
  const mins = now.getMinutes()
  const rounded = mins < 15 ? 0 : mins < 45 ? 30 : 60
  if (rounded === 60) now.setHours(now.getHours() + 1, 0)
  else now.setMinutes(rounded)
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function AddInteractionDialog({ defaultPersonId, clients, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState(defaultPersonId ?? '')
  const [type, setType] = useState<string>('In-Person')
  const [date, setDate] = useState(todayStr)
  const [time, setTime] = useState(roundedTimeStr)
  const [duration, setDuration] = useState('60')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isSync = SYNC_TYPES.includes(type)
  const effectivePersonId = defaultPersonId ?? personId

  const canSubmit =
    !!effectivePersonId &&
    date.length > 0 &&
    (isSync ? time.length > 0 : true) &&
    !saving

  function handleOpen() {
    setPersonId(defaultPersonId ?? '')
    setType('In-Person')
    setDate(todayStr())
    setTime(roundedTimeStr())
    setDuration('60')
    setNotes('')
    setSaveError(null)
    setOpen(true)
  }

  function handleOpenChange(v: boolean) {
    if (saving) return
    setOpen(v)
    if (!v) setSaveError(null)
  }

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    setSaveError(null)

    try {
      // Async types default to noon if no time entered
      const timeStr = time || '12:00'
      const startIso = new Date(`${date}T${timeStr}:00`).toISOString()

      await logManualSessionAction({
        subjectPersonId: effectivePersonId,
        startIso,
        durationMinutes: isSync ? Number(duration) : 0,
        interactionType: type,
        notes: notes.trim() || undefined,
      })

      toast.success('Interaction logged')
      setOpen(false)
      router.refresh()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'NO_RELATIONSHIP') {
        setSaveError('No active relationship found for this person.')
      } else {
        setSaveError('Failed to log interaction — please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const triggerEl = trigger ? (
    <div onClick={handleOpen}>{trigger}</div>
  ) : (
    <Button variant="outline" size="sm" onClick={handleOpen}>
      <Plus className="h-4 w-4" />
      Add Interaction
    </Button>
  )

  return (
    <>
      {triggerEl}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Interaction</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person picker — only shown from dashboard (no defaultPersonId) */}
            {!defaultPersonId && clients && (
              <div className="space-y-1.5">
                <Label htmlFor="ai-person">
                  Person <span className="text-destructive">*</span>
                </Label>
                <Select value={personId} onValueChange={setPersonId} disabled={saving}>
                  <SelectTrigger id="ai-person">
                    <SelectValue placeholder="Select a person…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Interaction type */}
            <div className="space-y-1.5">
              <Label htmlFor="ai-type">Type</Label>
              <Select value={type} onValueChange={setType} disabled={saving}>
                <SelectTrigger id="ai-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-date">Date</Label>
                <Input
                  id="ai-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-time">
                  Time{!isSync && <span className="text-muted-foreground font-normal"> (optional)</span>}
                </Label>
                <Input
                  id="ai-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Duration — only for synchronous types */}
            {isSync && (
              <div className="space-y-1.5">
                <Label htmlFor="ai-duration">Duration</Label>
                <Select value={duration} onValueChange={setDuration} disabled={saving}>
                  <SelectTrigger id="ai-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="ai-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="ai-notes"
                placeholder="What happened, follow-ups, observations…"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                disabled={saving}
              />
            </div>
          </div>

          {saveError && <p className="text-xs text-destructive -mt-1">{saveError}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Saving…' : saveError ? 'Try Again' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
