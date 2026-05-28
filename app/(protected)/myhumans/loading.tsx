export default function UsersLoading() {
  return (
    <>
      {/* PageHeader skeleton */}
      <div className="bg-card border-b border-border px-8 py-5">
        <div className="h-8 w-36 bg-muted animate-pulse rounded" />
        <div className="h-4 w-52 bg-muted animate-pulse rounded mt-2" />
      </div>

      <div className="p-8 space-y-6">
        {/* Search bar skeleton */}
        <div className="h-9 w-full max-w-sm bg-muted animate-pulse rounded-lg" />

        {/* Cards grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 bg-card rounded-lg shadow-sm p-4">
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                <div className="h-3 w-2/5 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
