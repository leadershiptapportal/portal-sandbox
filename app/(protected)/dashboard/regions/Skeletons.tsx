import { CheckSquare, Calendar } from 'lucide-react'

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse bg-muted rounded ${className}`} />
}

export function ComingUpNextSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 md:mb-5">
      {[1, 2, 3].map((i) => (
        <Pulse key={i} className="h-8 w-32 rounded-full flex-shrink-0" />
      ))}
    </div>
  )
}

export function UpcomingThisWeekSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">My Upcoming Interactions</span>
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
            <Pulse className="w-9 h-12 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-3.5 w-36" />
              <Pulse className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TasksSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <CheckSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Open Tasks</span>
      </div>
      <div className="divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="py-3 flex items-center gap-3">
            <Pulse className="w-5 h-5 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Pulse className="h-4 w-48" />
              <Pulse className="h-3 w-24" />
            </div>
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}


