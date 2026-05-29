import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAdminPortalUsers } from '@/lib/airtable/users'
import { getPermissionProfiles } from '@/lib/airtable/permissionProfiles'
import { UserRow } from './UserRow'

export default async function AdminUsersPage() {
  const [userRecord, users, profiles] = await Promise.all([
    getCurrentUserRecord(),
    getAdminPortalUsers(),
    getPermissionProfiles(),
  ])

  // The real admin's Airtable ID — used to prevent self-impersonation in UserRow
  const currentUserRecordId = userRecord.realAirtableId ?? userRecord.airtableId ?? ''

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {users.length} user{users.length !== 1 ? 's' : ''} with portal access
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No portal users found.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Permission Profile</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  profiles={profiles}
                  currentUserRecordId={currentUserRecordId}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <div className="mt-4 p-4 bg-muted/50 rounded-xl border border-border text-xs text-muted-foreground space-y-1">
        <p><strong className="text-foreground">Adding a new user:</strong> Find their record in the Humans table, set their Role, link a Permission Profile, and ensure their Work Email matches their Clerk login. Their Clerk User ID is written automatically on first login.</p>
        <p><strong className="text-foreground">View as:</strong> Impersonates a user for the current browser session (8-hour max). An amber banner appears while active.</p>
      </div>
    </div>
  )
}
