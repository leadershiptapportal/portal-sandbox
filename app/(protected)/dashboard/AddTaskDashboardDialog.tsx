'use client'

import { useState, useRef, useEffect } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, X } from 'lucide-react'
import { dashboardCreateTaskAction } from './actions'

interface Assignee {
  id: string
  name: string
}

interface Props {
  humans: Assignee[]
  coaches: Assignee[]
  /** Optional custom trigger element. If omitted, renders a default "+ Add Task" button. */
  trigger?: React.ReactNode
}

// Sentinel value for "Just me" — self-assign → personal_reminder
const PERSONAL_VALUE = '__personal__'
const MIN_CHARS = 2

export default function AddTaskDashboardDialog({ humans, coaches, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  // assignTo is PERSONAL_VALUE | a real airtable record ID
  const [assignTo, setAssignTo] = useState(PERSONAL_VALUE)
  const [assignName, setAssignName] = useState('Just me')
  const [query, setQuery] = useState('Just me')
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)

  const allPeople = [...humans, ...coaches]
  const searchResults =
    query.trim().length >= MIN_CHARS
      ? allPeople.filter(
          (p) =>
            p.name.toLowerCase().includes(query.trim().toLowerCase()) &&
            p.name !== 'Just me',
        )
      : []

  const canSubmit = title.trim().length > 0 && !saving

  // Resolve assignee for the visibility preview
  const assignee =
    assignTo === PERSONAL_VALUE
      ? null
      : allPeople.find((p) => p.id === assignTo) ?? null

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
        // If user blurred without a valid selection, revert to current selection
        if (assignTo === PERSONAL_VALUE) setQuery('Just me')
        else if (assignName) setQuery(assignName)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [assignTo, assignName])

  function handleOpen() {
    setTitle('')
    setDescription('')
    setDueDate('')
    setAssignTo(PERSONAL_VALUE)
    setAssignName('Just me')
    setQuery('Just me')
    setShowResults(false)
    setError('')
    setOpen(true)
  }

  function selectPerson(id: string, name: string) {
    setAssignTo(id)
    setAssignName(name)
    setQuery(name)
    setShowResults(false)
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

    const result = await dashboardCreateTaskAction({
      title: title.trim(),
      notes: description.trim() || undefined,
      dueDate: dueDate || undefined,
      assignedToPersonId: assignTo === PERSONAL_VALUE ? undefined : assignTo,
    })

    setSaving(false)
    if (!result.success) {
      setError('Failed to add task — please try again')
      return
    }
    toast.success('Task added')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      {trigger ? (
        <div onClick={handleOpen}>{trigger}</div>
      ) : (
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-task-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="add-task-title"
                placeholder="e.g. Send interaction recap email"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-task-notes">Notes</Label>
              <Textarea
                id="add-task-notes"
                placeholder="Optional details…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-task-due">Due Date</Label>
              <Input
                id="add-task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5" ref={searchRef}>
              <Label>Assign To</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    // Clear selection if user edits after picking someone
                    if (e.target.value !== assignName) {
                      setAssignTo(PERSONAL_VALUE)
                      setAssignName('Just me')
                    }
                    setShowResults(true)
                  }}
                  onFocus={() => setShowResults(true)}
                  placeholder="Search by name…"
                  disabled={saving}
                  className="w-full pl-9 pr-9 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] placeholder:text-slate-400 disabled:opacity-50"
                />
                {query && query !== 'Just me' && (
                  <button
                    type="button"
                    onClick={() => selectPerson(PERSONAL_VALUE, 'Just me')}
                    disabled={saving}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {showResults && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                    {/* "Just me" is always pinned at the top */}
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectPerson(PERSONAL_VALUE, 'Just me') }}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-slate-100 ${
                        assignTo === PERSONAL_VALUE ? 'bg-slate-50 font-medium text-slate-900' : 'hover:bg-slate-50'
                      }`}
                    >
                      Just me
                    </button>

                    {query.trim().length >= MIN_CHARS && (
                      searchResults.length > 0 ? (
                        searchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); selectPerson(p.id, p.name) }}
                            className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-slate-50 last:border-0 ${
                              assignTo === p.id ? 'bg-slate-50 font-medium text-slate-900' : 'hover:bg-slate-50'
                            }`}
                          >
                            {p.name}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-sm text-slate-400 italic">
                          No matching people found.
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
              {query.trim().length > 0 && query !== 'Just me' && query.trim().length < MIN_CHARS && (
                <p className="text-xs text-slate-400">Keep typing to search…</p>
              )}
              {/* Visibility preview */}
              {assignee ? (
                <p className="text-xs text-blue-600">
                  This task will be visible to {assignee.name}.
                </p>
              ) : (
                <p className="text-xs text-slate-400">Only visible to you.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            {error && (
              <p className="text-xs font-medium text-rose-600 mr-auto self-center">{error}</p>
            )}
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSubmit}>
              {saving ? 'Adding…' : 'Add Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
