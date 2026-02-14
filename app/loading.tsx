export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-slate-200 h-16" />

      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-500 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="h-10 w-3/4 bg-white/20 rounded-lg mx-auto mb-4 animate-pulse" />
          <div className="h-6 w-1/2 bg-white/15 rounded-lg mx-auto animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-slate-200 p-5 animate-pulse">
              <div className="h-5 w-3/4 bg-slate-200 rounded mb-3" />
              <div className="h-4 w-1/2 bg-slate-100 rounded mb-3" />
              <div className="h-4 w-full bg-slate-100 rounded mb-2" />
              <div className="h-4 w-2/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
