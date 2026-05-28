export default function MeetingDetailLoading() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Back link */}
      <div className="h-4 w-28 bg-muted rounded animate-pulse mb-6" />

      {/* Meeting header card */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="h-6 w-64 bg-muted rounded animate-pulse" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse mt-2" />
        {/* Participant chips */}
        <div className="flex gap-2 mt-4">
          <div className="h-6 w-36 bg-muted rounded-full animate-pulse" />
          <div className="h-6 w-28 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="h-3 w-44 bg-muted rounded animate-pulse mt-3" />
      </div>

      {/* Notes section */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="h-3 w-32 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Follow-up message section */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="h-3 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  )
}
