'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Mail, Plus, Users, Send } from 'lucide-react'
import type { Newsletter } from '@/lib/newsletter/types'
import { AdminUnavailable } from '@/components/admin/AdminUnavailable'

const STATUS_STYLES: Record<Newsletter['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  ready_for_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<Newsletter['status'], string> = {
  draft: 'Draft',
  ready_for_review: 'Ready for review',
  approved: 'Approved for sending',
  sent: 'Sent',
  failed: 'Failed',
}

export default function AdminNewsletterListPage() {
  const [authed, setAuthed] = useState(false)
  const [dbError, setDbError] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newType, setNewType] = useState<'weekly' | 'events'>('events')
  const [newSubject, setNewSubject] = useState('')
  const [newWeekOf, setNewWeekOf] = useState('')
  const [loadingThisWeek, setLoadingThisWeek] = useState(false)
  const [thisWeekError, setThisWeekError] = useState('')

  async function goToThisWeek() {
    setLoadingThisWeek(true)
    setThisWeekError('')
    try {
      const res = await fetch('/api/admin/newsletter/this-week')
      if (res.ok) {
        const data = await res.json()
        window.location.href = `/admin/newsletter/${data.newsletter.id}`
        return
      }
      if (res.status === 401) {
        setAuthed(false)
      } else {
        setThisWeekError("Couldn't open this week's newsletter — the database may be temporarily unavailable. Try again shortly.")
      }
    } catch {
      setThisWeekError("Couldn't open this week's newsletter — the database may be temporarily unavailable. Try again shortly.")
    } finally {
      setLoadingThisWeek(false)
    }
  }

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
      loadNewsletters()
    } else {
      setLoginError('Incorrect password')
    }
  }

  async function loadNewsletters() {
    const res = await fetch('/api/admin/newsletter')
    if (res.status === 401) {
      setAuthed(false)
      return
    }
    if (!res.ok) {
      setDbError(true)
      return
    }
    const data = await res.json()
    setNewsletters(data.newsletters || [])
  }

  const probe = useCallback(() => {
    setDbError(false)
    fetch('/api/admin/newsletter')
      .then((res) => {
        if (res.ok) {
          setAuthed(true)
          return res.json().then((data) => setNewsletters(data.newsletters || []))
        }
        if (res.status !== 401) setDbError(true)
      })
      .catch(() => setDbError(true))
  }, [])

  useEffect(() => {
    probe()
  }, [probe])

  async function createNewsletter(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, subject: newSubject, weekOf: newWeekOf || null }),
      })
      if (res.ok) {
        const data = await res.json()
        window.location.href = `/admin/newsletter/${data.newsletter.id}`
      }
    } finally {
      setCreating(false)
    }
  }

  if (dbError) {
    return <AdminUnavailable onRetry={probe} />
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
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-6 h-6 text-purple-600" /> Newsletter
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Weekly roundups and events & offers emails</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-slate-500 hover:underline">
              &larr; Admin
            </Link>
            <Link href="/admin/newsletter/subscribers" className="text-sm text-purple-600 hover:underline flex items-center gap-1">
              <Users className="w-4 h-4" /> Subscribers
            </Link>
            <Link href="/admin/venues" className="text-sm text-slate-500 hover:underline">
              Venues
            </Link>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={goToThisWeek}
            disabled={loadingThisWeek}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          >
            <Mail className="w-4 h-4" /> {loadingThisWeek ? 'Loading…' : "This week's newsletter"}
          </button>
          <button
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus className="w-4 h-4" /> New events/offers email
          </button>
        </div>

        {thisWeekError && (
          <p className="text-sm text-red-600 mb-4">{thisWeekError}</p>
        )}

        {showCreate && (
          <form onSubmit={createNewsletter} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 grid gap-3 sm:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'weekly' | 'events')}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="weekly">Weekly newsletter</option>
                <option value="events">Events & offers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Week of</label>
              <input
                type="date"
                value={newWeekOf}
                onChange={(e) => setNewWeekOf(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject line</label>
              <input
                type="text"
                required
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="5 soft play spots worth the drive this weekend"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                disabled={creating}
                className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {creating ? 'Creating…' : 'Create draft'}
              </button>
            </div>
          </form>
        )}

        {newsletters.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Send className="w-10 h-10 mx-auto mb-3" />
            <p>No newsletters yet — create one above.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Subject</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Week of</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {newsletters.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/newsletter/${n.id}`} className="font-medium text-slate-900 hover:text-purple-600">
                        {n.subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell capitalize text-slate-500">{n.type}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                      {n.week_of ? new Date(n.week_of).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[n.status]}`}>
                        {STATUS_LABELS[n.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
