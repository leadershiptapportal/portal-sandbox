'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateUserRoleAction, updateUserPermissionProfileAction, startImpersonationAction } from './actions'
import type { AdminPortalUser } from '@/lib/airtable/users'
import type { PermissionProfile } from '@/lib/airtable/permissionProfiles'

const ROLE_OPTIONS = [
  { value: 'admin',  label: 'Admin' },
  { value: 'coach',  label: 'Coach' },
  { value: 'client', label: 'Client' },
]

const ROLE_BADGE: Record<string, string> = {
  admin:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  coach:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  client: 'bg-muted text-muted-foreground',
}

interface Props {
  user: AdminPortalUser
  profiles: PermissionProfile[]
  currentUserRecordId: string  // to prevent self-impersonation
}

export function UserRow({ user, profiles, currentUserRecordId }: Props) {
  const [role, setRole] = useState(user.role)
  const [profileId, setProfileId] = useState(user.permissionProfileIds[0] ?? '')
  const [rolePending, startRoleTransition] = useTransition()
  const [profilePending, startProfileTransition] = useTransition()
  const [impersonatePending, startImpersonateTransition] = useTransition()

  function handleRoleChange(newRole: string) {
    const prev = role
    setRole(newRole)
    startRoleTransition(async () => {
      try {
        await updateUserRoleAction(user.id, newRole)
        toast.success(`Role updated to ${newRole}`)
      } catch {
        setRole(prev)
        toast.error('Failed to update role')
      }
    })
  }

  function handleProfileChange(newProfileId: string) {
    const prev = profileId
    setProfileId(newProfileId)
    startProfileTransition(async () => {
      try {
        await updateUserPermissionProfileAction(user.id, newProfileId)
        const profileName = profiles.find((p) => p.id === newProfileId)?.name ?? 'None'
        toast.success(`Permission profile set to ${profileName}`)
      } catch {
        setProfileId(prev)
        toast.error('Failed to update permission profile')
      }
    })
  }

  function handleImpersonate() {
    startImpersonateTransition(() => startImpersonationAction(user.id))
  }

  const lastLogin = user.lastPortalLogin
    ? new Date(user.lastPortalLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never'

  const isSelf = user.id === currentUserRecordId

  return (
    <tr className="hover:bg-muted/30 transition-colors border-b border-border last:border-0">
      {/* Name + email */}
      <td className="px-4 py-3">
        <div className="font-medium text-foreground text-sm">{user.name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
      </td>

      {/* Role inline select */}
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={rolePending || isSelf}
          className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 disabled:opacity-60 disabled:cursor-default ${ROLE_BADGE[role] ?? ROLE_BADGE.client}`}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {isSelf && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}
      </td>

      {/* Permission profile inline select */}
      <td className="px-4 py-3">
        <select
          value={profileId}
          onChange={(e) => handleProfileChange(e.target.value)}
          disabled={profilePending}
          className="text-sm text-foreground bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 disabled:opacity-60 max-w-[180px]"
        >
          <option value="">— No profile —</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </td>

      {/* Last login */}
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {lastLogin}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        {!isSelf && (
          <button
            onClick={handleImpersonate}
            disabled={impersonatePending}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted transition-colors disabled:opacity-40"
          >
            {impersonatePending ? 'Starting…' : 'View as'}
          </button>
        )}
      </td>
    </tr>
  )
}
