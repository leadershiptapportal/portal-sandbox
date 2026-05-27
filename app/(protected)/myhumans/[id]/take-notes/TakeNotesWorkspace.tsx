'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import PersonSidebar from './PersonSidebar'
import TakeNotesCanvas from './TakeNotesCanvas'
import LastInteractionNotesDialog from '@/components/LastInteractionNotesDialog'
import type { User, Interaction } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'
import type { ProfileOption } from '@/lib/airtable/users'
import type { LastNoteData } from '@/components/LastInteractionNotesDialog'
import type { RelationshipContext } from '@/lib/airtable/relationships'

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
}

export default function TakeNotesWorkspace({
  person,
  coachContext,
  profileOptions,
  meetings,
  initialInteraction,
  userCanWrite,
  lastInteractionNote,
  relationships = [],
}: Props) {
  const router = useRouter()
  const [savedPersonData, setSavedPersonData] = useState(person)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
    if (hasStrokes) {
      const confirmed = window.confirm('You have unsaved notes. Are you sure you want to leave?')
      if (!confirmed) return
    }
    router.back()
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-white">
      {/* Minimal top bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
        <Link
          href={`/myhumans/${person.id}`}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Back to profile"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-slate-400 leading-none font-medium">
            {hasStrokes ? 'Continue Taking Notes' : 'Take Notes'}
          </p>
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
            {displayName}
          </p>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: collapsible person details sidebar */}
        <aside
          className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 transition-all duration-200 ${
            sidebarCollapsed ? 'w-10 overflow-hidden' : 'w-72 xl:w-80 overflow-y-auto'
          }`}
        >
          {/* Collapse / expand toggle strip */}
          <div
            className={`flex border-b border-slate-100 py-1.5 px-1.5 ${
              sidebarCollapsed ? 'justify-center' : 'justify-end'
            }`}
          >
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              title={sidebarCollapsed ? 'Show profile panel' : 'Hide profile panel'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {!sidebarCollapsed && (
            <>
              {/* "View last interaction notes" — prominent button at top of sidebar */}
              {lastInteractionNote && (
                <div className="px-3 pt-3 pb-2 border-b border-slate-100">
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
              />
            </>
          )}
        </aside>

        {/* Right: ink canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
          <TakeNotesCanvas
            personId={person.id}
            personName={displayName}
            meetings={meetings}
            initialInteraction={initialInteraction}
            onSaveComplete={handleSaveComplete}
            onCancel={handleCancel}
            onStrokeCountChange={(count) => setHasStrokes(count > 0)}
          />
        </div>
      </div>
    </div>
  )
}
