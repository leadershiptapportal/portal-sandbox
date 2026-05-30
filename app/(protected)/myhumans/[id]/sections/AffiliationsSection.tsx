import { Building2, Pencil, Star } from 'lucide-react'
import AffiliationDialog from '../AffiliationDialog'
import type { Affiliation } from '@/lib/types'

interface OrgOption {
  id: string
  name: string
}

interface Props {
  subjectHumanId: string
  affiliations: Affiliation[]
  organizations: OrgOption[]
  canEdit: boolean
}

const TYPE_LABELS: Record<string, string> = {
  employee: 'Employee',
  contractor: 'Contractor',
  member: 'Member',
  client: 'Client',
  founder: 'Founder / Owner',
  alum: 'Alum',
  other: 'Other',
}

function AffiliationPill({
  affiliation,
  subjectHumanId,
  canEdit,
}: {
  affiliation: Affiliation
  subjectHumanId: string
  canEdit: boolean
}) {
  const isInactive = affiliation.status !== 'Active'
  const orgInitials = (affiliation.organizationName ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isInactive ? 'border-border bg-muted/50 opacity-70' : 'border-border bg-card'
      }`}
    >
      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold flex-shrink-0">
        {orgInitials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">
            {affiliation.organizationName ?? 'Unknown organization'}
          </p>
          {affiliation.primary && (
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" aria-label="Primary" />
          )}
        </div>
        {affiliation.titleAtOrg && (
          <p className="text-xs text-muted-foreground truncate">{affiliation.titleAtOrg}</p>
        )}
        <p className="text-xs text-muted-foreground/70">
          {TYPE_LABELS[affiliation.type] ?? affiliation.type}
          {isInactive && ` · ${affiliation.status}`}
        </p>
      </div>

      {canEdit && (
        <AffiliationDialog
          mode="edit"
          affiliationId={affiliation.id}
          subjectHumanId={subjectHumanId}
          orgName={affiliation.organizationName ?? 'Unknown organization'}
          initialType={affiliation.type}
          initialStatus={affiliation.status}
          initialStartDate={affiliation.startDate}
          initialEndDate={affiliation.endDate}
          initialTitleAtOrg={affiliation.titleAtOrg}
          initialPrimary={affiliation.primary}
          trigger={
            <button
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 mt-0.5"
              aria-label="Edit organization affiliation"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
        />
      )}
    </div>
  )
}

export default function AffiliationsSection({
  subjectHumanId,
  affiliations,
  organizations,
  canEdit,
}: Props) {
  // Primary first, then active before inactive, then by org name.
  const sorted = [...affiliations].sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      Number(a.status !== 'Active') - Number(b.status !== 'Active') ||
      (a.organizationName ?? '').localeCompare(b.organizationName ?? ''),
  )

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Organizations</h2>
        </div>
        {canEdit && (
          <AffiliationDialog
            mode="add"
            subjectHumanId={subjectHumanId}
            organizations={organizations}
          />
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 italic">No organizations linked yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sorted.map((aff) => (
            <AffiliationPill
              key={aff.id}
              affiliation={aff}
              subjectHumanId={subjectHumanId}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}
