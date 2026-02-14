export default function VenueLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-slate-200 h-16" />

      {/* Breadcrumb skeleton */}
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="bg-gradient-to-b from-purple-600 to-purple-700 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-8 w-2/3 bg-white/20 rounded-lg mb-3 animate-pulse" />
          <div className="h-5 w-1/3 bg-white/15 rounded-lg mb-3 animate-pulse" />
          <div className="h-5 w-1/4 bg-white/10 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Badges */}
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 w-20 bg-slate-200 rounded-full animate-pulse" />
              ))}
            </div>

            {/* About section */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
              <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-slate-100 rounded" />
                <div className="h-4 w-full bg-slate-100 rounded" />
                <div className="h-4 w-3/4 bg-slate-100 rounded" />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 h-48 animate-pulse" />
            <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
              <div className="space-y-3">
                <div className="h-10 w-full bg-slate-200 rounded" />
                <div className="h-10 w-full bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
