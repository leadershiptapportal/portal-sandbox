import { Suspense } from 'react'
import { getHumans, getHumansByRelationship } from '@/lib/services/humansService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getHourInTimezone } from '@/lib/utils/dateFormat'
import DashboardTagline from './DashboardTagline'
import ComingUpNextRegion from './regions/ComingUpNextRegion'
import OpenTasksRegion from './regions/OpenTasksRegion'
import UpcomingThisWeekRegion from './regions/UpcomingThisWeekRegion'
import {
  ComingUpNextSkeleton,
  TasksSkeleton,
  UpcomingThisWeekSkeleton,
} from './regions/Skeletons'
import type { Human } from '@/lib/types'

function getTimeOfDay(): { label: string; emoji: string } {
  const h = getHourInTimezone()
  if (h < 12) return { label: 'morning', emoji: '☀️' }
  if (h < 17) return { label: 'afternoon', emoji: '👋' }
  return { label: 'evening', emoji: '🌙' }
}

function getDisplayName(user: Human): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.workEmail ?? ''
}

export default async function DashboardPage() {
  const sessionUser = await getSessionUser()
  const userRecord = await getCurrentUserRecord()

  const isAdmin = userRecord.role === 'admin'

  const users = await (isAdmin || !userRecord.airtableId
    ? getHumans(sessionUser)
    : getHumansByRelationship(userRecord.airtableId))

  const coachUser = users.find(
    (u) =>
      u.workEmail?.toLowerCase() === sessionUser?.email?.toLowerCase(),
  )
  const firstName =
    coachUser?.preferredName ??
    coachUser?.firstName ??
    coachUser?.fullName?.split(' ')[0] ??
    (userRecord.name.split(' ')[0] || null) ??
    sessionUser?.email?.split('@')[0] ??
    'Coach'

  return (
    <div className="p-4 md:p-6 lg:p-8">

      {/* ── Greeting ─────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-foreground">
          Good {getTimeOfDay().label}, {firstName} {getTimeOfDay().emoji}
        </h1>
        <DashboardTagline />
      </div>

      {/* ── Today chips + admin calendar ─────────────────────────────────────── */}
      <Suspense fallback={<ComingUpNextSkeleton />}>
        <ComingUpNextRegion userRecord={userRecord} />
      </Suspense>

      {/* ── My Upcoming Interactions (left) + Open Tasks (right) ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Suspense fallback={<UpcomingThisWeekSkeleton />}>
          <UpcomingThisWeekRegion userRecord={userRecord} />
        </Suspense>
        <Suspense fallback={<TasksSkeleton />}>
          <OpenTasksRegion userRecord={userRecord} />
        </Suspense>
      </div>

    </div>
  )
}
