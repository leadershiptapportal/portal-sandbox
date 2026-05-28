import { FileText } from 'lucide-react'
import { SectionHeading } from './helpers'
import type { User } from '@/lib/types'

interface Props {
  user: User
}

export default function ProfileDetailsSection({ user }: Props) {
  if (!(user.department || user.title || user.startDate || user.engagementLevel)) return null

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={FileText} title="Profile Details" />
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        {user.title && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Title</dt>
            <dd className="text-sm text-foreground">{user.title}</dd>
          </div>
        )}
        {user.department && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Department</dt>
            <dd className="text-sm text-foreground">{user.department}</dd>
          </div>
        )}
        {user.startDate && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Start Date</dt>
            <dd className="text-sm text-foreground">
              {new Date(user.startDate + 'T12:00:00').toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </dd>
          </div>
        )}
        {user.engagementLevel && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Engagement Level</dt>
            <dd>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user.engagementLevel.toLowerCase().includes('high')
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : user.engagementLevel.toLowerCase().includes('low')
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
              }`}>
                {user.engagementLevel}
              </span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  )
}
