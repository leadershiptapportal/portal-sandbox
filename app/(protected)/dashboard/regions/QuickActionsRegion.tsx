import { getUsers, getHumansByRelationship, getPortalCoaches } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import DashboardQuickActions from '../DashboardQuickActions'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import type { User } from '@/lib/types'

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

interface Props {
  userRecord: CurrentUserRecord
}

export default async function QuickActionsRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'

  const [users, coachUsers] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getHumansByRelationship(userRecord.airtableId),
    getPortalCoaches(userRecord.airtableId ?? undefined),
  ])

  const humans = users.map((u) => ({ id: u.id, name: getDisplayName(u) }))
  const coaches = coachUsers.map((u) => ({ id: u.id, name: getDisplayName(u) }))

  return <DashboardQuickActions humans={humans} coaches={coaches} />
}
