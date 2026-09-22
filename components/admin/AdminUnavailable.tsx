'use client'

/**
 * Shown instead of the login wall when an admin auth probe fails with a
 * non-401 status (typically the Neon DB rejecting queries once its usage
 * quota is exhausted, per lib/pool.ts). Every admin page previously treated
 * ANY failed probe as "not logged in", so a DB outage looked exactly like an
 * expired session — this makes that distinction visible instead of silently
 * bouncing a still-valid session back to the password form.
 */
export function AdminUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl text-center">
        <h1 className="text-xl font-bold text-slate-900 mb-2">Admin temporarily unavailable</h1>
        <p className="text-sm text-slate-500 mb-6">
          The database isn&apos;t responding — this isn&apos;t a login issue, your session is still
          valid. Try again shortly.
        </p>
        <button
          onClick={onRetry}
          className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg text-sm hover:bg-slate-800 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
