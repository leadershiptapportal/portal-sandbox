'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Type } from 'lucide-react'
import PersonSidebar from './PersonSidebar'
import TakeNotesCanvas from './TakeNotesCanvas'
import TakeNotesTyped from './TakeNotesTyped'
import LastInteractionNotesDialog from '@/components/LastInteractionNotesDialog'
import type { User, Interaction } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'
import type { ProfileOption } from '@/lib/airtable/users'
import type { LastNoteData } from '@/components/LastInteractionNotesDialog'
import type { RelationshipContext } from '@/lib/airtable/relationships'
import type { Note } from '@/lib/airtable/notes'
import type { NoteCategory } from '../actions'

interface ProfileOptions {
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allUsers: ProfileOption[]
}

interface Props {
  person: User
  coachContext: CoachPersonContext | null
  profileOptions: ProfileOptions
  meetings: Interaction[]
  initialInteraction: Interaction | null
  userCanWrite: boolean
  lastInteractionNote?: LastNoteData | null
  relationships?: RelationshipContext[]
  rcNotes?: Map<string, Note>
  existingInkNote?: Note | null
  noteCategory?: NoteCategory
  existingTypedNote?: Note | null
}

type InputMode = 'type' | 'ink'
const MODE_KEY = 'notes-input-mode-pref'

export default function TakeNotesWorkspace({
  person,
  coachContext,
  profileOptions,
  meetings,
  initialInteraction,
  userCanWrite,
  lastInteractionNote,
  relationships = [],
  rcNotes = new Map(),
  existingInkNote,
  noteCategory = 'general',
  existingTypedNote,
}: Props) {
  const router = useRouter()
  const [savedPersonData, setSavedPersonData] = useState(person)
  const [hasUnsavedContent, setHasUnsavedContent] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inputMode, setInputModeState] = useState<InputMode>('type')
  const [modeReady, setModeReady] = useState(false)

  // Determine default mode from stored preference or device type
  useEffect(() => {
    const stored = localStorage.getItem(MODE_KEY) as InputMode | null
    if (stored === 'ink' || stored === 'type') {
      setInputModeState(stored)
    } else {
      // Touch/stylus devices default to ink; pointer devices default to type
      const isTouch = window.matchMedia('(pointer: coarse)').matches
      setInputModeState(isTouch ? 'ink' : 'type')
    }
    setModeReady(true)
  }, [])

  function setInputMode(mode: InputMode) {
    setInputModeState(mode)
    setHasUnsavedContent(false)
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
  }

  const displayName =
    savedPersonData.preferredName ||
    savedPersonData.fullName ||
    [savedPersonData.firstName, savedPersonData.lastName].filter(Boolean).join(' ') ||
    savedPersonData.email

  function handleSaveComplete() {
    router.push(`/myhumans/${person.id}`)
    router.refresh()
  }

  function handleCancel() {
    if (hasUnsavedContent) {
      const confirmed = window.confirm('You have unsaved notes. Are you sure you want to leave?')
      if (!confirmed) return
    }
    router.back()
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-card">
      {/* Minimal top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        <Link
          href={`/myhumans/${person.id}`}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Back to profile"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground leading-none font-medium">
            {noteCategory === 'prep' ? 'Prep Notes' : noteCategory === 'interaction' ? 'Interaction Notes' : 'General Notes'}
          </p>
          <p className="text-sm font-semibold text-foreground truncate leading-tight">
            {displayName}
          </p>
        </div>

        {/* Input mode toggle */}
        {modeReady && (
          <div className="inline-flex rounded-md border border-border overflow-hidden flex-shrink-0">
            <button
              onClick={() => setInputMode('type')}
              aria-pressed={inputMode === 'type'}
              title="Typed notes"
              className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors ${
                inputMode === 'type'
                  ? 'bg-[hsl(213,70%,30%)] text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Type className="h-3.5 w-3.5" />
              Type
            </button>
            <button
              onClick={() => setInputMode('ink')}
              aria-pressed={inputMode === 'ink'}
              title="Handwritten notes"
              className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium border-l border-border transition-colors ${
                inputMode === 'ink'
                  ? 'bg-[hsl(213,70%,30%)] text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Draw
            </button>
          </div>
        )}
      </header>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: collapsible person details sidebar */}
        <aside
          className={`flex-shrink-0 border-r border-border bg-muted/50 transition-all duration-200 ${
            sidebarCollapsed ? 'w-10 overflow-hidden' : 'w-72 xl:w-80 overflow-y-auto'
          }`}
        >
          {/* Collapse / expand toggle strip */}
          <div
            className={`flex border-b border-border py-1.5 px-1.5 ${
              sidebarCollapsed ? 'justify-center' : 'justify-end'
            }`}
          >
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="flex items-center gap-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs"
              title={sidebarCollapsed ? 'Show profile panel' : 'Hide profile panel'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <span>Hide Profile Details</span>
                  <ChevronLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              {lastInteractionNote && (
                <div className="px-3 pt-3 pb-2 border-b border-border">
                  <LastInteractionNotesDialog
                    note={lastInteractionNote}
                    variant="prominent"
                    label="View last interaction notes"
                  />
                </div>
              )}

              <PersonSidebar
                person={savedPersonData}
                coachContext={coachContext}
                profileOptions={profileOptions}
                userCanWrite={userCanWrite}
                onPersonUpdate={(updated) => setSavedPersonData((prev) => ({ ...prev, ...updated }))}
                relationships={relationships}
                rcNotes={rcNotes}
              />
            </>
          )}
        </aside>

        {/* Right: note input area */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted">
          {!modeReady ? (
            <div className="w-full h-full bg-card animate-pulse" />
          ) : inputMode === 'ink' ? (
            <TakeNotesCanvas
              personId={person.id}
              personName={displayName}
              meetings={meetings}
              initialInteraction={initialInteraction}
              existingInkNote={existingInkNote}
              noteCategory={noteCategory}
              onSaveComplete={handleSaveComplete}
              onCancel={handleCancel}
              onStrokeCountChange={(count) => setHasUnsavedContent(count > 0)}
            />
          ) : (
            <TakeNotesTyped
              personId={person.id}
              meetings={meetings}
              initialInteraction={initialInteraction}
              existingNote={existingTypedNote}
              noteCategory={noteCategory}
              onSaveComplete={handleSaveComplete}
              onCancel={handleCancel}
              onContentChange={(hasContent) => setHasUnsavedContent(hasContent)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
