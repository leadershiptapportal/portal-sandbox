import Link from 'next/link'
import {
  ChevronRight,
  CheckSquare,
  Paperclip,
} from 'lucide-react'
import BackLink from '@/components/BackLink'
import { getHumanById } from '@/lib/services/humansService'
import { getInteractionsForUser } from '@/lib/services/interactionsService'
import { getUserMessages } from '@/lib/services/messagesService'
import { getNotesByUser, getGeneralNotesByRCIds, getQuickNoteForRC } from '@/lib/airtable/notes'
import { getTasksByUser } from '@/lib/airtable/tasks'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import {
  getDirectReports,
  getRelationshipsForHuman,
} from '@/lib/airtable/relationships'
import { getAllHumans, fetchPersonalityOptions } from '@/lib/airtable/humans'
import { getAffiliationsForHuman } from '@/lib/airtable/affiliations'
import { listOrganizations } from '@/lib/airtable/organizations'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import { getDisplayName, getInitials, isRecordId, SectionHeading } from './sections/helpers'
import ProfileCardSection from './sections/ProfileCardSection'
import MostRecentInteractionSection from './sections/MostRecentInteractionSection'
import PersonalityStrengthsSection from './sections/PersonalityStrengthsSection'
import CoachNotesSection from './sections/CoachNotesSection'
import TheirTeamSection from './sections/TheirTeamSection'
import MessagesSection from './sections/MessagesSection'
import TasksSection from './sections/TasksSection'
import RelationshipsSection from './sections/RelationshipsSection'
import AffiliationsSection from './sections/AffiliationsSection'
import type { Human, Note, Task, Affiliation } from '@/lib/types'

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
    getHumanById(id),
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Human not found.</p>
      </div>
    )
  }

  const contactEmail = user.workEmail ?? ''
  const managerId = null
  const coachId = user.coachIds?.[0] ?? null
  const teamLeadId = user.teamLeadIds?.[0] ?? null
  const teamMemberIdList = user.teamMemberIds ?? []
  // Resolved display name — passed to getInteractionsForUser so the lookup can
  // also match interactions via the {Client Name} field (set by sync), not just
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
    affiliations,
    organizationOptions,
  ] = await Promise.all([
    // Every fetch is wrapped in `.catch(...)` so a single failing Airtable
    // call (permission, rate limit, transient network) can't reject the
    // whole Promise.all and crash the page. The UI handles empty/null for
    // each piece of data individually.
    getInteractionsForUser(contactEmail, sessionUser, id, currentUserRecord.email || undefined, displayName)
      .catch(() => ({ upcoming: [], past: [] })),
    getUserMessages(id).catch(() => []),
    getNotesByUser(id).catch(() => [] as Note[]),
    getTasksByUser(id).catch(() => [] as Task[]),
    managerId ? getHumanById(managerId).catch(() => null) : Promise.resolve(null),
    coachId ? getHumanById(coachId).catch(() => null) : Promise.resolve(null),
    teamLeadId ? getHumanById(teamLeadId).catch(() => null) : Promise.resolve(null),
    Promise.all(teamMemberIdList.map((tid) => getHumanById(tid).catch(() => null))),
    getDirectReports(id).catch(() => []),
    getRelationshipsForHuman(id).catch(() => []),
    getAllHumans().catch(() => [] as Human[]),
    fetchPersonalityOptions().catch(() => null),
    getAffiliationsForHuman(id).catch(() => [] as Affiliation[]),
    listOrganizations().catch(() => []),
  ])

  // Resolve the coach's RC with this person, then batch quick note + RC notes
  const coachRC = currentUserRecord.airtableId
    ? allPersonRelationships.find((rc) => rc.leadId === currentUserRecord.airtableId) ?? null
    : null

  const [rcNotes, quickNote] = await Promise.all([
    currentUserRecord.airtableId
      ? getGeneralNotesByRCIds(
          allPersonRelationships.map((rc) => rc.id),
          currentUserRecord.airtableId,
        ).catch(() => new Map())
      : Promise.resolve(new Map()),
    coachRC && currentUserRecord.airtableId
      ? getQuickNoteForRC(coachRC.id, currentUserRecord.airtableId).catch(() => null)
      : Promise.resolve(null),
  ])

  const directReports = theirTeamReports
  const teamMembers = teamMemberResults.filter((u): u is Human => u !== null)
  // Only show notes not attached to a meeting in the standalone Notes section.
  // Meeting-linked notes belong to their interaction's detail view.
  const standaloneNotes = sessionNotes.filter(
    (n) => n.noteType !== 'interaction_note' && n.noteType !== 'prep_note',
  )

  const permissionLevel = await getPermissionLevel(
    currentUserRecord.airtableId,
    currentUserRecord.role,
    id,
  )
  const userCanWrite = canWrite(permissionLevel)

  const orgNameById = new Map(organizationOptions.map((o) => [o.id, o.name]))

  const pastSorted = [...past].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )
  const topInteractions = pastSorted.slice(0, 3)
  const totalInteractionCount = pastSorted.length

  const noteStatusByInteractionId = sessionNotes.reduce<Record<string, { hasNotes: boolean; hasInk: boolean }>>(
    (acc, note) => {
      if (!note.interactionId) return acc
      const prev = acc[note.interactionId] ?? { hasNotes: false, hasInk: false }
      return {
        ...acc,
        [note.interactionId]: {
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
  const conflictPostureOption = personalityOptions?.conflictPostures.find(
    (o) => user.conflictPostureIds?.includes(o.id),
  )
  const enneagramLabel = enneagramOption?.name
  const mbtiLabel = mbtiOption?.name
  const conflictPostureLabel = conflictPostureOption?.name
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
    user.title ??
    (user.role && !isRecordId(user.role) ? user.role : undefined)

  // Show preferred name only when it differs from the display name
  const showPreferredName =
    user.preferredName &&
    user.preferredName !== name &&
    !isRecordId(user.preferredName)

  const badges = [
    user.role && !isRecordId(user.role)
      ? { label: user.role, className: 'bg-muted text-muted-foreground' }
      : null,
  ].filter((b): b is { label: string; className: string } => b !== null)

  return (
    <div className="px-4 py-5 md:p-8 max-w-5xl mx-auto space-y-6">

      {/* Back link — goes to wherever the user actually came from. */}
      <BackLink fallbackHref="/users" label="Back" />

      {/* Breadcrumb trail for downstream navigation */}
      {trailEntries.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap" aria-label="Org trail">
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
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
              </span>
            )
          })}
          <span className="font-semibold text-foreground">{name}</span>
        </nav>
      )}

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
        quickNotes={quickNote?.content ?? null}
        quickNoteRcId={coachRC?.id ?? null}
        humanId={id}
      />

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
            u.workEmail ||
            u.id,
        }))}
        canEdit={userCanWrite}
        rcNotes={rcNotes}
        currentCoachId={currentUserRecord.airtableId ?? ''}
        orgNameById={orgNameById}
        organizations={organizationOptions}
      />

      {/* ── Organizations (affiliations) ──────────────────────────────────── */}
      <AffiliationsSection
        subjectHumanId={id}
        affiliations={affiliations}
        organizations={organizationOptions}
        canEdit={userCanWrite}
      />

      {/* ── Most Recent Interactions ──────────────────────────────────────── */}
      <MostRecentInteractionSection
        topInteractions={topInteractions}
        totalInteractionCount={totalInteractionCount}
        userId={id}
        noteStatusByInteractionId={noteStatusByInteractionId}
      />

      {/* ── Personality & Strengths ───────────────────────────────────────── */}
      <PersonalityStrengthsSection
        user={user}
        enneagramLabel={enneagramLabel}
        mbtiLabel={mbtiLabel}
        conflictPostureLabel={conflictPostureLabel}
        strengthDescriptors={Object.keys(strengthDescriptors).length > 0 ? strengthDescriptors : undefined}
      />

      {/* ── Coach Notes ──────────────────────────────────────────────────── */}
      <CoachNotesSection sessionNotes={standaloneNotes} userCanWrite={userCanWrite} userId={id} />

      {/* ── Their Team ───────────────────────────────────────────────────── */}
      <TheirTeamSection
        directReports={directReports}
        nextTrail={nextTrail}
        canDrillDeeper={canDrillDeeper}
      />

      {/* ── Messages & Follow-ups ────────────────────────────────────────── */}
      <MessagesSection messages={messages} userId={id} userCanWrite={userCanWrite} />

      {/* ── Tasks ────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={CheckSquare} title="Tasks" />
        <TasksSection tasks={tasks} />
      </div>

      {/* ── Resources ────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
        <SectionHeading icon={Paperclip} title="Resources" />
        <PlaceholderSection
          icon={<Paperclip />}
          title="No resources yet"
          message="Resources and documents attached to this human will appear here."
        />
      </div>

    </div>
  )
}
