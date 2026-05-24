'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileText } from 'lucide-react'
import NoteComposer from '@/components/notes/NoteComposer'

interface Client {
  id: string
  name: string
}

interface Props {
  /** Pre-set person — hides the person picker (use from profile page) */
  userId?: string
  /** Shown in the person picker (use from dashboard) */
  clients?: Client[]
  /** Custom trigger element; if omitted a default button is rendered */
  trigger?: React.ReactNode
}

export default function LogNoteDialog({ userId, clients, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState(userId ?? '')

  const effectivePersonId = userId ?? personId

  function handleOpen() {
    setPersonId(userId ?? '')
    setOpen(true)
  }

  const triggerEl = trigger ? (
    <div onClick={handleOpen}>{trigger}</div>
  ) : (
    <Button variant="outline" size="sm" onClick={handleOpen}>
      <FileText />
      Log a Note
    </Button>
  )

  return (
    <>
      {triggerEl}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person picker — only when no userId pre-set */}
            {!userId && clients && (
              <div className="space-y-1.5">
                <Label>Person</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a person…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {effectivePersonId ? (
              <NoteComposer
                subjectPersonId={effectivePersonId}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
                hideInkLink
              />
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">
                Select a person above to write your note.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
