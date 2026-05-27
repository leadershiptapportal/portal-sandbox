'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchClientInteractionsAction, dashboardLogNoteAction } from './actions'

interface Client {
  id: string
  name: string
}

interface InteractionOption {
  id: string
  label: string
}

interface Props {
  clients: Client[]
  /** Optional custom trigger element. If omitted, renders a plain text button. */
  trigger?: React.ReactNode
}

export default function GlobalLogNoteDialog({ clients, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [content, setContent] = useState('')
  const [interactionId, setInteractionId] = useState('')
  const [interactions, setInteractions] = useState<InteractionOption[]>([])
  const [interactionsLoading, setInteractionsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = clientId.length > 0 && content.trim().length > 0 && !saving

  // Fetch interactions whenever client changes
  useEffect(() => {
    if (!clientId) {
      setInteractions([])
      setInteractionId('')
      return
    }
    let cancelled = false
    setInteractionsLoading(true)
    setInteractionId('')
    fetchClientInteractionsAction(clientId).then((results) => {
      if (!cancelled) {
        setInteractions(results)
        setInteractionsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [clientId])

  function handleOpen() {
    setClientId('')
    setContent('')
    setInteractionId('')
    setInteractions([])
    setError('')
    setOpen(true)
  }

  function handleClose() {
    if (saving) return
    setOpen(false)
    setError('')
  }

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    setError('')
    const result = await dashboardLogNoteAction({
      clientId,
      content: content.trim(),
      interactionId: (interactionId && interactionId !== '__none__') ? interactionId : undefined,
    })
    setSaving(false)
    if (!result.success) {
      setError('Failed to save note — please try again')
      return
    }
    toast.success('Note saved')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {trigger ? (
        <div onClick={handleOpen}>{trigger}</div>
      ) : (
        <button
          onClick={handleOpen}
          className="text-sm font-medium text-[hsl(213,70%,30%)] hover:underline"
        >
          Log a Note
        </button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden p-0">

          {/* Fixed header */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>Log a Note</DialogTitle>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
            {/* Client */}
            <div className="space-y-1.5">
              <Label htmlFor="log-note-client">
                Person <span className="text-destructive">*</span>
              </Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="log-note-client">
                  <SelectValue placeholder="Select a person..." />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Note content */}
            <div className="space-y-1.5">
              <Label htmlFor="log-note-content">
                Note <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="log-note-content"
                placeholder="What happened in this interaction or observation?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                disabled={saving}
              />
            </div>

            {/* Interaction link — only shown after a person is selected */}
            {clientId && (
              <div className="space-y-1.5">
                <Label htmlFor="log-note-interaction">Link to an interaction</Label>
                <Select
                  value={interactionId}
                  onValueChange={setInteractionId}
                  disabled={interactionsLoading || saving}
                >
                  <SelectTrigger id="log-note-interaction">
                    <SelectValue placeholder={
                      interactionsLoading
                        ? 'Loading interactions…'
                        : 'General note (not tied to an interaction)'
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 overflow-y-auto">
                    <SelectItem value="__none__">General note (not tied to an interaction)</SelectItem>
                    {interactions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  {interactionId && interactionId !== '__none__'
                    ? 'This note will be saved to the interaction record'
                    : 'This note will be saved as a general coaching note'}
                </p>
              </div>
            )}
          </div>

          {/* Fixed footer */}
          <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-end gap-2">
            {error && (
              <p className="text-xs font-medium text-rose-600 mr-auto">{error}</p>
            )}
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Saving…' : 'Save Note'}
            </Button>
          </div>

        </DialogContent>
      </Dialog>
    </>
  )
}
