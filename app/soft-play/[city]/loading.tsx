export default function CityLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-slate-200 h-16" />

      {/* Breadcrumb skeleton */}
      <div className="bg-white border-b border-slate-100 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-500 py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 w-2/3 bg-white/20 rounded-lg mb-3 animate-pulse" />
          <div className="h-5 w-1/2 bg-white/15 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-white border-b border-slate-200 py-3 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-slate-100 rounded-md animate-pulse" />
          ))}
        </div>
      </div>

      {/* Venue grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-5 w-32 bg-slate-200 rounded mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 overflow-hidden animate-pulse">
              <div className="p-5">
                <div className="h-5 w-3/4 bg-slate-200 rounded mb-3" />
                <div className="h-4 w-1/2 bg-slate-100 rounded mb-3" />
                <div className="flex gap-1.5">
                  <div className="h-6 w-16 bg-slate-100 rounded-full" />
                  <div className="h-6 w-16 bg-slate-100 rounded-full" />
                </div>
              </div>
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
                <div className="h-8 w-full bg-slate-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
