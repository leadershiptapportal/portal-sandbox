'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PersonSidebar from './PersonSidebar'
import TakeNotesCanvas from './TakeNotesCanvas'
import type { User, Meeting } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'
import type { ProfileOption } from '@/lib/airtable/users'

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
  meetings: Meeting[]
  initialInteraction: Meeting | null
  userCanWrite: boolean
}

export default function TakeNotesWorkspace({
  person,
  coachContext,
  profileOptions,
  meetings,
  initialInteraction,
  userCanWrite,
}: Props) {
  const router = useRouter()
  const [savedPersonData, setSavedPersonData] = useState(person)

  const displayName =
    savedPersonData.preferredName ||
    savedPersonData.fullName ||
    [savedPersonData.firstName, savedPersonData.lastName].filter(Boolean).join(' ') ||
    savedPersonData.email

  function handleSaveComplete() {
    router.push(`/myhumans/${person.id}`)
    router.refresh()
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
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400 leading-none font-medium">
            Take Notes
          </p>
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
            {displayName}
          </p>
        </div>
      </header>

      {/* Two-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: person details sidebar */}
        <aside className="w-72 xl:w-80 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-slate-50">
          <PersonSidebar
            person={savedPersonData}
            coachContext={coachContext}
            profileOptions={profileOptions}
            userCanWrite={userCanWrite}
            onPersonUpdate={(updated) => setSavedPersonData((prev) => ({ ...prev, ...updated }))}
          />
        </aside>

        {/* Right: ink canvas */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-100">
          <TakeNotesCanvas
            personId={person.id}
            personName={displayName}
            meetings={meetings}
            initialInteraction={initialInteraction}
            onSaveComplete={handleSaveComplete}
          />
        </div>
      </div>
    </div>
  )
}
