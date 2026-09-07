'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Send, Eye, Loader2 } from 'lucide-react'

interface JobConfig {
  key: 'monthly' | 'slipping' | 'renewals'
  title: string
  description: string
}

const JOBS: JobConfig[] = [
  {
    key: 'monthly',
    title: 'Monthly insights',
    description: 'Views/clicks/enquiries for the last 30 days, sent to active Premium/Bespoke venues.',
  },
  {
    key: 'slipping',
    title: 'Listing needs attention',
    description: 'Nudges claimed venues with a low completeness score or stale last-verified date. Skips anyone reminded in the last 30 days.',
  },
  {
    key: 'renewals',
    title: 'Annual renewal reminders',
    description: 'Annual Premium subscribers renewing in the next 7 days. Monthly subscribers are never emailed this.',
  },
]

interface Preview {
  count: number
  recipients: Record<string, unknown>[]
  commit: boolean
}

export default function AdminInsightsPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, Preview>>({})

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: password }),
    })
    if (res.ok) setAuthed(true)
    else setLoginError('Incorrect password')
  }

  async function run(job: string, commit: boolean) {
    setLoading(job)
    try {
      const res = await fetch(`/api/admin/insights/${job}?commit=${commit}`, { method: 'POST' })
      if (res.status === 401) { setAuthed(false); return }
      const data = await res.json()
      setPreviews((prev) => ({ ...prev, [job]: data }))
    } finally {
      setLoading(null)
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
          <h1 className="text-xl font-bold text-slate-900 mb-6 text-center">Admin Access</h1>
          <form onSubmit={login} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700"
              autoFocus
            />
            {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg text-sm hover:bg-slate-800 transition-colors">
              Sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Retention Emails</h1>
            <p className="text-slate-500 text-sm mt-0.5">Always preview before sending — these go to real venue owners.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/venues" className="text-purple-600 hover:underline">Venues →</Link>
            <Link href="/admin/claims" className="text-purple-600 hover:underline">Claims →</Link>
          </div>
        </div>

        <div className="space-y-4">
          {JOBS.map((job) => {
            const preview = previews[job.key]
            return (
              <div key={job.key} className="bg-white rounded-xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-900">{job.title}</h2>
                <p className="text-sm text-slate-500 mt-1 mb-4">{job.description}</p>

                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => run(job.key, false)}
                    disabled={loading === job.key}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 rounded-lg disabled:opacity-60"
                  >
                    {loading === job.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    Preview
                  </button>
                  {preview && !preview.commit && preview.count > 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Send this email to ${preview.count} venue owner(s)? This can't be undone.`)) {
                          run(job.key, true)
                        }
                      }}
                      disabled={loading === job.key}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg disabled:opacity-60"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send to {preview.count}
                    </button>
                  )}
                  {preview?.commit && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                      <Mail className="w-3.5 h-3.5" /> Sent to {preview.count} owner(s)
                    </span>
                  )}
                </div>

                {preview && preview.count > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {preview.recipients.map((r, i) => (
                          <tr key={i}>
                            {Object.entries(r).map(([k, v]) => (
                              <td key={k} className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                                <span className="text-slate-400">{k}:</span> {String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {preview && preview.count === 0 && (
                  <p className="text-xs text-slate-400">No venues currently match this job&apos;s criteria.</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
