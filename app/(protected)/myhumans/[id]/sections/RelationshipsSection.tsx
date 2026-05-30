import Link from 'next/link'
import { Network, UserCheck, Users as UsersIcon, Pencil, Heart, Briefcase, TrendingUp, Handshake } from 'lucide-react'
import RelationshipDialog from '../RelationshipDialog'
import RCNoteInlineEdit from './RCNoteInlineEdit'
import { SectionHeading } from './helpers'
import type { RelationshipContext } from '@/lib/airtable/relationships'
import type { Note } from '@/lib/airtable/notes'

interface Person {
  id: string
  name: string
}

interface Props {
  subjectPersonId: string
  subjectName: string
  relationships: RelationshipContext[]
  allPeople: Person[]
  canEdit: boolean
  /** General notes keyed by RC ID, authored by the current coach. */
  rcNotes: Map<string, Note>
  /** Airtable ID of the viewing coach — passed to RCNoteInlineEdit. */
  currentCoachId: string
}

type BucketRole = 'coach' | 'coachee' | 'manager' | 'report' | 'client' | 'prospect' | 'personal' | 'peer'

interface BucketItem {
  rc: RelationshipContext
  otherPersonId: string
  otherName: string
  otherTitle?: string
  role: BucketRole
}

function classifyRelationship(rc: RelationshipContext, subjectId: string): BucketItem | null {
  const subjectIsPerson = rc.humanId === subjectId
  const otherPersonId = subjectIsPerson ? rc.leadId : rc.humanId
  const otherName     = subjectIsPerson ? rc.leadName : rc.humanName
  const otherTitle    = subjectIsPerson ? rc.leadTitle : rc.humanTitle

  if (rc.relationshipType === 'coaching') {
    return { rc, otherPersonId, otherName, otherTitle, role: subjectIsPerson ? 'coach' : 'coachee' }
  }
  if (rc.relationshipType === 'reports_to') {
    return { rc, otherPersonId, otherName, otherTitle, role: subjectIsPerson ? 'manager' : 'report' }
  }
  if (rc.relationshipType === 'client') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'client' }
  }
  if (rc.relationshipType === 'prospect') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'prospect' }
  }
  if (rc.relationshipType === 'personal') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'personal' }
  }
  if (rc.relationshipType === 'peer') {
    return { rc, otherPersonId, otherName, otherTitle, role: 'peer' }
  }
  return null
}

function RelationshipPill({
  item,
  subjectPersonId,
  subjectName,
  canEdit,
  note,
  currentCoachId,
}: {
  item: BucketItem
  subjectPersonId: string
  subjectName: string
  canEdit: boolean
  note: Note | undefined
  currentCoachId: string
}) {
  const initials = item.otherName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isInactive = item.rc.status && item.rc.status !== 'Active'

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isInactive
          ? 'border-border bg-muted/50 opacity-70'
          : 'border-border bg-card hover:border-border'
      }`}
    >
      <Link
        href={`/myhumans/${item.otherPersonId}`}
        className="flex items-center gap-3 flex-shrink-0"
      >
        <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
          {initials}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/myhumans/${item.otherPersonId}`}
          className="group"
        >
          <p className="text-sm font-medium text-foreground truncate group-hover:text-[hsl(213,70%,30%)]">
            {item.otherName}
          </p>
          {item.otherTitle && (
            <p className="text-xs text-muted-foreground truncate">{item.otherTitle}</p>
          )}
          {isInactive && (
            <p className="text-xs text-muted-foreground">{item.rc.status}</p>
          )}
        </Link>

        <RCNoteInlineEdit
          rcId={item.rc.id}
          subjectPersonId={item.otherPersonId}
          initialNote={note?.content ?? ''}
          currentCoachId={currentCoachId}
        />
      </div>

      {canEdit && (
        <RelationshipDialog
          mode="edit"
          rcId={item.rc.id}
          subjectPersonId={subjectPersonId}
          subjectName={subjectName}
          otherPersonId={item.otherPersonId}
          otherName={item.otherName}
          initialRole={
            item.role === 'client' ? 'client_of' :
            item.role === 'prospect' ? 'prospect_of' :
            item.role
          }
          initialStartDate={item.rc.startDate}
          initialStatus={item.rc.status as 'Active' | 'Inactive' | 'Paused' | 'Ended'}
          trigger={
            <button
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 mt-0.5"
              aria-label="Edit relationship"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
        />
      )}
    </div>
  )
}

function RelationshipGroup({
  label,
  icon: Icon,
  items,
  subjectPersonId,
  subjectName,
  canEdit,
  emptyText,
  rcNotes,
  currentCoachId,
  hideWhenEmpty,
}: {
  label: string
  icon: React.ElementType
  items: BucketItem[]
  subjectPersonId: string
  subjectName: string
  canEdit: boolean
  emptyText: string
  rcNotes: Map<string, Note>
  currentCoachId: string
  hideWhenEmpty?: boolean
}) {
  if (items.length === 0) {
    if (hideWhenEmpty) return null
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </p>
        <p className="text-sm text-muted-foreground/60 italic">{emptyText}</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className="ml-1 text-muted-foreground/60 font-normal">{items.length}</span>
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <RelationshipPill
            key={item.rc.id}
            item={item}
            subjectPersonId={subjectPersonId}
            subjectName={subjectName}
            canEdit={canEdit}
            note={rcNotes.get(item.rc.id)}
            currentCoachId={currentCoachId}
          />
        ))}
      </div>
    </div>
  )
}

export default function RelationshipsSection({
  subjectPersonId,
  subjectName,
  relationships,
  allPeople,
  canEdit,
  rcNotes,
  currentCoachId,
}: Props) {
  const classified = relationships
    .map((rc) => classifyRelationship(rc, subjectPersonId))
    .filter((b): b is BucketItem => b !== null)

  const coachees  = classified.filter((b) => b.role === 'coachee')
  const reports   = classified.filter((b) => b.role === 'report')
  const clients   = classified.filter((b) => b.role === 'client')
  const prospects = classified.filter((b) => b.role === 'prospect')
  const personal  = classified.filter((b) => b.role === 'personal')
  const peers     = classified.filter((b) => b.role === 'peer')

  const groupProps = { subjectPersonId, subjectName, canEdit, rcNotes, currentCoachId }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Relationships</h2>
        </div>
        {canEdit && (
          <RelationshipDialog
            mode="add"
            subjectPersonId={subjectPersonId}
            subjectName={subjectName}
            people={allPeople}
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        <RelationshipGroup
          label="Coachees"
          icon={UserCheck}
          items={coachees}
          emptyText={`${subjectName}'s coachees will appear here`}
          hideWhenEmpty
          {...groupProps}
        />
        <RelationshipGroup
          label="Direct Reports"
          icon={UsersIcon}
          items={reports}
          emptyText="No direct reports"
          {...groupProps}
        />
        <RelationshipGroup
          label="Clients"
          icon={Briefcase}
          items={clients}
          emptyText="No clients linked"
          hideWhenEmpty
          {...groupProps}
        />
        <RelationshipGroup
          label="Prospects"
          icon={TrendingUp}
          items={prospects}
          emptyText="No prospects linked"
          hideWhenEmpty
          {...groupProps}
        />
        <RelationshipGroup
          label="Peers"
          icon={Handshake}
          items={peers}
          emptyText="No peers linked"
          hideWhenEmpty
          {...groupProps}
        />
        <RelationshipGroup
          label="Personal"
          icon={Heart}
          items={personal}
          emptyText="No personal connections linked"
          {...groupProps}
        />
      </div>
    </div>
  )
}
