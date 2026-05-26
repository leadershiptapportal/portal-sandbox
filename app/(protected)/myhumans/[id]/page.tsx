import Link from 'next/link'
import {
  ChevronRight,
  CheckSquare,
  Paperclip,
} from 'lucide-react'
import BackLink from '@/components/BackLink'
import { getUserById } from '@/lib/services/usersService'
import { getMeetingsForUser } from '@/lib/services/meetingsService'
import { getUserMessages } from '@/lib/services/messagesService'
import { getNotesByUser } from '@/lib/airtable/notes'
import { getTasksByUser } from '@/lib/airtable/tasks'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import {
  getDirectReports,
  getRelationshipsForPerson,
} from '@/lib/airtable/relationships'
import { getAllUsers, fetchPersonalityOptions } from '@/lib/airtable/users'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import UserActionsBar from './UserActionsBar'
import { getDisplayName, getInitials, isRecordId, SectionHeading } from './sections/helpers'
import ProfileCardSection from './sections/ProfileCardSection'
import MostRecentSessionSection from './sections/MostRecentSessionSection'
import PersonalityStrengthsSection from './sections/PersonalityStrengthsSection'
import ProfileDetailsSection from './sections/ProfileDetailsSection'
import CoachNotesSection from './sections/CoachNotesSection'
import TheirTeamSection from './sections/TheirTeamSection'
import MessagesSection from './sections/MessagesSection'
import TasksSection from './sections/TasksSection'
import RelationshipsSection from './sections/RelationshipsSection'
import type { User, Note, Task } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ trail?: string }>
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function UserDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { trail: trailParam } = await searchParams

  // Parse breadcrumb trail: comma-separated "recID:Name" pairs
  const trailEntries: Array<{ id: string; name: string }> = (trailParam ?? '')
    .split(',')
    .filter(Boolean)
    .map((seg) => {
      const idx = seg.indexOf(':')
      return idx > 0
        ? { id: seg.slice(0, idx), name: decodeURIComponent(seg.slice(idx + 1)) }
        : { id: seg, name: seg }
    })
  const currentDepth = trailEntries.length  // 0 = top-level, 1 = one hop, etc.
  const MAX_DRILL_DEPTH = 3

  const [user, sessionUser, currentUserRecord] = await Promise.all([
    getUserById(id),
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-slate-500">User not found.</p>
      </div>
    )
  }

  const contactEmail = user.workEmail ?? user.email
  const managerId = user.managerIds?.[0] ?? null
  const reportIds = user.directReportIds ?? []
  const coachId = user.coachIds?.[0] ?? null
  const teamLeadId = user.teamLeadIds?.[0] ?? null
  const teamMemberIdList = user.teamMemberIds ?? []
  // Resolved display name — passed to getMeetingsForUser so the lookup can
  // also match meetings via the {Client Name} field (set by sync), not just
  // by email substring in {Attendees}. Belt-and-suspenders for sparse data.
  const displayName = getDisplayName(user)

  const [
    { past },
    messages,
    sessionNotes,
    tasks,
    manager,
    coach,
    teamLead,
    teamMemberResults,
    theirTeamReports,
    allPersonRelationships,
    allUsersForPicker,
    personalityOptions,
  ] = await Promise.all([
    // Every fetch is wrapped in `.catch(...)` so a single failing Airtable
    // call (permission, rate limit, transient network) can't reject the
    // whole Promise.all and crash the page. The UI handles empty/null for
    // each piece of data individually.
    getMeetingsForUser(contactEmail, sessionUser, id, currentUserRecord.email || undefined, displayName)
      .catch(() => ({ upcoming: [], past: [] })),
    getUserMessages(id).catch(() => []),
    getNotesByUser(id).catch(() => [] as Note[]),
    getTasksByUser(id).catch(() => [] as Task[]),
    managerId ? getUserById(managerId).catch(() => null) : Promise.resolve(null),
    coachId ? getUserById(coachId).catch(() => null) : Promise.resolve(null),
    teamLeadId ? getUserById(teamLeadId).catch(() => null) : Promise.resolve(null),
    Promise.all(teamMemberIdList.map((tid) => getUserById(tid).catch(() => null))),
    getDirectReports(id).catch(() => []),
    getRelationshipsForPerson(id).catch(() => []),
    getAllUsers().catch(() => [] as User[]),
    fetchPersonalityOptions().catch(() => null),
  ])

  const directReports = theirTeamReports
  const teamMembers = teamMemberResults.filter((u): u is User => u !== null)
  // Only show notes not attached to a meeting in the standalone Notes section.
  // Meeting-linked notes belong to their interaction's detail view.
  const standaloneNotes = sessionNotes.filter((n) => n.noteType !== 'interaction_note')

  const permissionLevel = await getPermissionLevel(
    currentUserRecord.airtableId,
    currentUserRecord.role,
    id,
  )
  const userCanWrite = canWrite(permissionLevel)

  const pastSorted = [...past].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
  const topMeetings = pastSorted.slice(0, 3)
  const totalMeetingCount = pastSorted.length

  const noteStatusByMeetingId = sessionNotes.reduce<Record<string, { hasNotes: boolean; hasInk: boolean }>>(
    (acc, note) => {
      if (!note.meetingId) return acc
      const prev = acc[note.meetingId] ?? { hasNotes: false, hasInk: false }
      return {
        ...acc,
        [note.meetingId]: {
          hasNotes: prev.hasNotes || note.noteType === 'interaction_note',
          hasInk: prev.hasInk || note.noteType === 'ink_note',
        },
      }
    },
    {},
  )

  const name = getDisplayName(user)
  const initials = getInitials(user)

  // Resolve formatted personality display labels from the options tables.
  // e.g. "Type 1 | The Reformer", "INTJ | Architect"
  const enneagramOption = personalityOptions?.enneagrams.find(
    (o) => user.enneagramIds?.includes(o.id),
  )
  const mbtiOption = personalityOptions?.mbtis.find(
    (o) => user.mbtiIds?.includes(o.id),
  )
  const enneagramLabel = enneagramOption?.name
  const mbtiLabel = mbtiOption?.name
  const strengthDescriptors: Record<string, string> = {}
  if (personalityOptions?.strengths && user.strengths) {
    for (const s of user.strengths) {
      const opt = personalityOptions.strengths.find((o) => o.name === s.name)
      if (opt?.descriptor) strengthDescriptors[s.name] = opt.descriptor
    }
  }

  // Build the next trail segment for downstream drill-down links
  const nextTrail = [...trailEntries, { id, name }]
    .map((e) => `${e.id}:${encodeURIComponent(e.name)}`)
    .join(',')
  const canDrillDeeper = currentDepth < MAX_DRILL_DEPTH

  const displayTitle =
    user.jobTitle ??
    (user.role && !isRecordId(user.role) ? user.role : undefined)

  // Show preferred name only when it differs from the display name
  const showPreferredName =
    user.preferredName &&
    user.preferredName !== name &&
    !isRecordId(user.preferredName)

  const badges = [
    enneagramLabel
      ? { label: enneagramLabel, className: 'bg-blue-50 text-blue-700' }
      : user.enneagram && !isRecordId(user.enneagram)
      ? { label: `Enneagram ${user.enneagram}`, className: 'bg-blue-50 text-blue-700' }
      : null,
    mbtiLabel
      ? { label: mbtiLabel, className: 'bg-violet-50 text-violet-700' }
      : user.mbtiType
      ? { label: user.mbtiType.split('-')[0], className: 'bg-violet-50 text-violet-700' }
      : user.mbti && !isRecordId(user.mbti)
      ? { label: user.mbti, className: 'bg-violet-50 text-violet-700' }
      : null,
    user.role && !isRecordId(user.role)
      ? { label: user.role, className: 'bg-slate-100 text-slate-600' }
      : null,
    // Relationship flags badges were sourced from the deprecated Coach-Person
    // Context table. After the Item 11 cutover they're surfaced as Notes with
    // note_type='general_context' instead.
  ].filter((b): b is { label: string; className: string } => b !== null)

  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto space-y-6">

      {/* Back link — goes to wherever the user actually came from. */}
      <BackLink fallbackHref="/users" label="Back" />

      {/* Breadcrumb trail for downstream navigation */}
      {trailEntries.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-slate-500 flex-wrap" aria-label="Org trail">
          {trailEntries.map((entry, i) => {
            // Build partial trail up to this entry
            const partialTrail = trailEntries
              .slice(0, i)
              .map((e) => `${e.id}:${encodeURIComponent(e.name)}`)
              .join(',')
            return (
              <span key={entry.id} className="flex items-center gap-1">
                <Link
                  href={`/myhumans/${entry.id}${partialTrail ? `?trail=${partialTrail}` : ''}`}
                  className="text-[hsl(213,70%,30%)] hover:underline font-medium"
                >
                  {entry.name}
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
              </span>
            )
          })}
          <span className="font-semibold text-slate-900">{name}</span>
        </nav>
      )}

      {/* ── Actions bar ──────────────────────────────────────────────────── */}
      {userCanWrite && <UserActionsBar userId={id} />}

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <ProfileCardSection
        user={user}
        name={name}
        initials={initials}
        contactEmail={contactEmail}
        displayTitle={displayTitle}
        showPreferredName={!!showPreferredName}
        badges={badges}
        coach={coach}
        teamLead={teamLead}
        userCanWrite={userCanWrite}
      />

      {/* ── Most Recent Interactions ──────────────────────────────────────── */}
      <MostRecentSessionSection
        topMeetings={topMeetings}
        totalMeetingCount={totalMeetingCount}
        userId={id}
        noteStatusByMeetingId={noteStatusByMeetingId}
      />

      {/* ── Personality & Strengths ───────────────────────────────────────── */}
      <PersonalityStrengthsSection
        user={user}
        enneagramLabel={enneagramLabel}
        mbtiLabel={mbtiLabel}
        strengthDescriptors={Object.keys(strengthDescriptors).length > 0 ? strengthDescriptors : undefined}
      />

      {/* ── Profile Details ──────────────────────────────────────────────── */}
      <ProfileDetailsSection user={user} />

      {/* ── Coach Notes ──────────────────────────────────────────────────── */}
      <CoachNotesSection sessionNotes={standaloneNotes} userCanWrite={userCanWrite} />

      {/* ── Relationships (coaches, coachees, manager, reports) ──────────── */}
      <RelationshipsSection
        subjectPersonId={id}
        subjectName={name}
        relationships={allPersonRelationships}
        allPeople={allUsersForPicker.map((u) => ({
          id: u.id,
          name:
            u.fullName ||
            [u.firstName, u.lastName].filter(Boolean).join(' ') ||
            u.email,
        }))}
        canEdit={userCanWrite}
      />

      {/* ── Their Team ───────────────────────────────────────────────────── */}
      <TheirTeamSection
        directReports={directReports}
        nextTrail={nextTrail}
        canDrillDeeper={canDrillDeeper}
      />

      {/* ── Messages & Follow-ups ────────────────────────────────────────── */}
      <MessagesSection messages={messages} userId={id} userCanWrite={userCanWrite} />

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={CheckSquare} title="Tasks" />
        <TasksSection tasks={tasks} />
      </div>

      {/* ── Resources ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={Paperclip} title="Resources" />
        <PlaceholderSection
          icon={<Paperclip />}
          title="No resources yet"
          message="Resources and documents attached to this person will appear here."
        />
      </div>

    </div>
  )
}
