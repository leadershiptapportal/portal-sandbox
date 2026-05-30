import { FileText } from 'lucide-react'
import { SectionHeading } from './helpers'
import type { User } from '@/lib/types'

interface Props {
  user: User
}

export default function ProfileDetailsSection({ user }: Props) {
  if (!(user.title || user.startDate)) return null

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
      </dl>
    </div>
  )
}
