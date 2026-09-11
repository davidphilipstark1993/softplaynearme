'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ExternalLink, ShieldCheck, Plus } from 'lucide-react'
import { PLAN_LABELS, type Plan, type PlanStatus } from '@/lib/plans'

interface AdminVenue {
  id: number
  name: string
  city_slug: string
  slug: string
  claimed_by_owner: boolean
  featured: boolean
  featured_until: string | null
  plan: Plan
  plan_status: PlanStatus
  plan_started_at: string | null
  ad_placements: { homepage?: boolean; city_pages?: string[] } | null
  needs_review: boolean
}

const PLANS: Plan[] = ['free', 'premium', 'bespoke']
const PLAN_STATUSES: PlanStatus[] = ['inactive', 'active', 'trialing', 'past_due', 'cancelled']

export default function AdminVenuesPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [venues, setVenues] = useState<AdminVenue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<number | null>(null)
  const [rowError, setRowError] = useState<Record<number, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', citySlug: '', address: '', postcode: '', phone: '', website: '' })
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

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
      loadVenues(1, '')
    } else {
      setLoginError('Incorrect password')
    }
  }

  async function loadVenues(targetPage = page, targetSearch = search) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(targetPage) })
      if (targetSearch) params.set('search', targetSearch)
      if (cityFilter) params.set('city', cityFilter)
      if (needsReviewOnly) params.set('needsReview', 'true')
      const res = await fetch(`/api/admin/venues?${params.toString()}`)
      if (res.status === 401) { setAuthed(false); return }
      const data = await res.json()
      setVenues(data.venues || [])
      setTotal(data.total || 0)
      setPage(targetPage)
    } finally {
      setLoading(false)
    }
  }

  async function addVenue(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/admin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAddError(data.error || 'Could not add venue')
        return
      }
      setAddForm({ name: '', citySlug: '', address: '', postcode: '', phone: '', website: '' })
      setShowAddForm(false)
      await loadVenues(1, search)
    } finally {
      setAdding(false)
    }
  }

  async function updateVenue(id: number, patch: Record<string, unknown>) {
    setUpdating(id)
    setRowError((prev) => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch('/api/admin/venues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRowError((prev) => ({ ...prev, [id]: data.error || 'Something went wrong' }))
        return
      }
      await loadVenues()
    } finally {
      setUpdating(null)
    }
  }

  useEffect(() => {
    fetch('/api/admin/venues').then((res) => {
      if (res.ok) {
        setAuthed(true)
        res.json().then((data) => {
          setVenues(data.venues || [])
          setTotal(data.total || 0)
        })
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

  const totalPages = Math.max(1, Math.ceil(total / 50))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Venues &amp; Plans</h1>
            <p className="text-slate-500 text-sm mt-0.5">{total} venues</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-slate-500 hover:underline">
              &larr; Admin
            </Link>
            <Link href="/admin/claims" className="text-sm text-purple-600 hover:underline">
              Claims →
            </Link>
            <Link href="/admin/newsletter" className="text-sm text-purple-600 hover:underline">
              Newsletter →
            </Link>
            <button
              onClick={() => setShowAddForm((s) => !s)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Venue
            </button>
            <button
              onClick={() => loadVenues()}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 bg-white px-3 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {showAddForm && (
          <form
            onSubmit={addVenue}
            className="mb-4 bg-white border border-purple-200 rounded-xl p-4 grid gap-3 sm:grid-cols-3"
          >
            <input
              required
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Venue name *"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              required
              value={addForm.citySlug}
              onChange={(e) => setAddForm((f) => ({ ...f, citySlug: e.target.value.toLowerCase() }))}
              placeholder="City slug * (e.g. london)"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={addForm.postcode}
              onChange={(e) => setAddForm((f) => ({ ...f, postcode: e.target.value }))}
              placeholder="Postcode"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={addForm.address}
              onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Address"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={addForm.website}
              onChange={(e) => setAddForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="Website"
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm sm:col-span-2"
            />
            <div className="sm:col-span-1 flex items-center gap-2">
              <button
                type="submit"
                disabled={adding}
                className="flex-1 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {addError && <p className="sm:col-span-3 text-xs text-red-600">{addError}</p>}
          </form>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); loadVenues(1, search) }}
          className="mb-4 flex flex-wrap gap-2"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue name…"
            className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <input
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value.toLowerCase())}
            placeholder="City slug filter…"
            className="w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg px-3 py-2 bg-white">
            <input
              type="checkbox"
              checked={needsReviewOnly}
              onChange={(e) => setNeedsReviewOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            Needs review only
          </label>
          <button
            type="submit"
            className="text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 px-4 py-2 rounded-lg"
          >
            Filter
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Needs review</th>
                  <th className="px-4 py-3">Claimed</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3">Featured until</th>
                  <th className="px-4 py-3">Homepage ad</th>
                  <th className="px-4 py-3">Sponsored on city pages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {venues.map((v) => (
                  <tr key={v.id} className={updating === v.id ? 'opacity-50' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{v.name}</div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {v.city_slug}
                        <a
                          href={`/soft-play/${v.city_slug}/${v.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-purple-500 hover:underline"
                        >
                          view <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      {rowError[v.id] && <p className="text-xs text-red-600 mt-1">{rowError[v.id]}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={v.needs_review}
                        disabled={updating === v.id}
                        onChange={(e) => updateVenue(v.id, { needsReview: e.target.checked })}
                        title="Uncheck once you've verified this venue's details"
                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {v.claimed_by_owner ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <ShieldCheck className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={v.plan}
                        disabled={updating === v.id}
                        onChange={(e) => updateVenue(v.id, { plan: e.target.value })}
                        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={v.plan_status}
                        disabled={updating === v.id}
                        onChange={(e) => updateVenue(v.id, { planStatus: e.target.value })}
                        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
                      >
                        {PLAN_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={v.featured}
                        disabled={updating === v.id}
                        onChange={(e) => updateVenue(v.id, { featured: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={v.featured_until ? v.featured_until.slice(0, 10) : ''}
                        disabled={updating === v.id}
                        onChange={(e) =>
                          updateVenue(v.id, { featuredUntil: e.target.value || null })
                        }
                        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
                        title="Leave blank for indefinite"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={!!v.ad_placements?.homepage}
                        disabled={updating === v.id}
                        onChange={(e) =>
                          updateVenue(v.id, {
                            adPlacements: { ...(v.ad_placements || {}), homepage: e.target.checked },
                          })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        defaultValue={(v.ad_placements?.city_pages || []).join(', ')}
                        disabled={updating === v.id}
                        placeholder="e.g. london, nottingham"
                        onBlur={(e) => {
                          const cityPages = e.target.value
                            .split(',')
                            .map((s) => s.trim().toLowerCase())
                            .filter(Boolean)
                          updateVenue(v.id, {
                            adPlacements: { ...(v.ad_placements || {}), city_pages: cityPages },
                          })
                        }}
                        className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white w-44"
                      />
                    </td>
                  </tr>
                ))}
                {venues.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">No venues found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => loadVenues(page - 1)}
              disabled={page <= 1 || loading}
              className="text-sm text-slate-600 disabled:opacity-40 hover:underline"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => loadVenues(page + 1)}
              disabled={page >= totalPages || loading}
              className="text-sm text-slate-600 disabled:opacity-40 hover:underline"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
