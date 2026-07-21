'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react'

interface Claim {
  id: number
  name: string
  email: string
  venue_name: string
  venue_address: string | null
  venue_phone: string | null
  venue_website: string | null
  city_slug: string | null
  venue_slug: string | null
  status: 'pending' | 'approved' | 'rejected'
  email_verified: boolean
  created_at: string
}

const STATUS_STYLES = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_ICONS = {
  pending:  <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle2 className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
}

export default function AdminClaimsPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<number | null>(null)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: password }),
    })
    if (res.ok) {
      setAuthed(true)
      loadClaims()
    } else {
      setLoginError('Incorrect password')
    }
  }

  async function loadClaims() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/claims')
      if (res.status === 401) { setAuthed(false); return }
      const data = await res.json()
      setClaims(data.claims || [])
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: number, status: string) {
    setUpdating(id)
    try {
      await fetch('/api/admin/claims', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      setClaims((prev) => prev.map((c) => c.id === id ? { ...c, status: status as Claim['status'] } : c))
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    // Try loading with existing session cookie
    fetch('/api/admin/claims').then((res) => {
      if (res.ok) {
        setAuthed(true)
        res.json().then((data) => setClaims(data.claims || []))
      }
    })
  }, [])

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
            <button
              type="submit"
              className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg text-sm hover:bg-slate-800 transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    )
  }

  const pending = claims.filter((c) => c.status === 'pending').length

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Venue Claims</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {pending > 0 ? `${pending} pending review` : 'No pending claims'}
              {' ·'} {claims.length} total
            </p>
          </div>
          <button
            onClick={loadClaims}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 bg-white px-3 py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Claims table */}
        {claims.length === 0 && !loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">No claims yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => {
              const venueUrl = claim.city_slug && claim.venue_slug
                ? `/soft-play/${claim.city_slug}/${claim.venue_slug}`
                : null
              const date = new Date(claim.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })

              return (
                <div
                  key={claim.id}
                  className={`bg-white rounded-xl border p-5 transition-opacity ${
                    claim.status === 'rejected' ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">

                    {/* Left: venue info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h2 className="font-semibold text-slate-900 text-base">{claim.venue_name}</h2>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[claim.status]}`}>
                          {STATUS_ICONS[claim.status]}
                          {claim.status}
                        </span>
                        {claim.email_verified && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            <CheckCircle2 className="w-3 h-3" /> Email verified
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-600">
                        <span className="font-medium">{claim.name}</span>
                        {' '}&lt;<a href={`mailto:${claim.email}`} className="text-purple-600 hover:underline">{claim.email}</a>&gt;
                      </p>

                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                        {claim.venue_address && <span>{claim.venue_address}</span>}
                        {claim.venue_phone && <span>{claim.venue_phone}</span>}
                        {claim.venue_website && (
                          <a href={claim.venue_website} target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline flex items-center gap-0.5">
                            {claim.venue_website} <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <span>Submitted {date}</span>
                      </div>

                      {venueUrl && (
                        <a
                          href={venueUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-purple-600 hover:underline"
                        >
                          View listing <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {/* Right: action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {claim.status !== 'approved' && (
                        <button
                          onClick={() => updateStatus(claim.id, 'approved')}
                          disabled={updating === claim.id}
                          className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                      {claim.status !== 'rejected' && (
                        <button
                          onClick={() => updateStatus(claim.id, 'rejected')}
                          disabled={updating === claim.id}
                          className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      )}
                      {claim.status !== 'pending' && (
                        <button
                          onClick={() => updateStatus(claim.id, 'pending')}
                          disabled={updating === claim.id}
                          className="text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
