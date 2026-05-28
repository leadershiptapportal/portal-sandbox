import { getPermissionProfiles } from '@/lib/airtable/permissionProfiles'
import { Check, X } from 'lucide-react'

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {on
        ? <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        : <X className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />}
      <span className={on ? 'text-foreground' : 'text-muted-foreground/60'}>{label}</span>
    </div>
  )
}

export default async function AdminProfilesPage() {
  const profiles = await getPermissionProfiles()

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Permission Profiles control which features are available to a portal user. Role (admin/coach/client) controls which data they can see.
      </p>

      {profiles.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No permission profiles found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((p) => (
            <div key={p.id} className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-foreground">{p.name}</h3>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.description}</p>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-border">
                <Flag on={p.canWriteNotes}          label="Write notes" />
                <Flag on={p.canCreateMeetings}      label="Create meetings" />
                <Flag on={p.canViewPersonProfile}   label="View person profiles" />
                <Flag on={p.canViewDirectReports}   label="View direct reports" />
              </div>

              <div className="pt-1 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Notes visibility: <span className="text-foreground font-medium">{p.notesDefaultVisibility.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-muted-foreground/50 truncate">{p.id}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground">
        <strong className="text-foreground">To add or edit profiles:</strong> Manage them directly in Airtable → Permission Profiles table. Changes reflect here immediately. Profile flags are enforced in the portal; no code deploy needed.
      </div>
    </div>
  )
}
