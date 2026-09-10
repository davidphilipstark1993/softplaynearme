'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Mail, Search } from 'lucide-react'
import type { NewsletterSubscriber } from '@/lib/newsletter/types'

interface Stats {
  total_subscribed: number
  weekly_subscribed: number
  events_subscribed: number
  total_unsubscribed: number
}

export default function AdminSubscribersPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)

  async function loadSubscribers(q = search) {
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    const res = await fetch(`/api/admin/newsletter/subscribers?${params.toString()}`)
    if (res.status === 401) {
      setAuthed(false)
      return
    }
    if (!res.ok) return
    const data = await res.json()
    setSubscribers(data.subscribers || [])
    setStats(data.stats || null)
    setTotal(data.total || 0)
  }

  useEffect(() => {
    fetch('/api/admin/newsletter/subscribers').then((res) => {
      if (res.ok) {
        setAuthed(true)
        res.json().then((data) => {
          setSubscribers(data.subscribers || [])
          setStats(data.stats || null)
          setTotal(data.total || 0)
        })
      }
    })
  }, [])

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
      loadSubscribers()
    } else {
      setLoginError('Incorrect password')
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
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-6 h-6 text-purple-600" /> Newsletter subscribers
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">{total} total</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/admin/newsletter/subscribers/export" className="btn-outline flex items-center gap-2 text-sm border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-50">
              <Download size={14} /> Export CSV
            </a>
            <Link href="/admin/newsletter" className="text-sm text-slate-500 hover:underline">
              &larr; Newsletters
            </Link>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Subscribed" value={stats.total_subscribed} />
            <StatCard label="Weekly newsletter" value={stats.weekly_subscribed} />
            <StatCard label="Events & offers" value={stats.events_subscribed} />
            <StatCard label="Unsubscribed" value={stats.total_unsubscribed} />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            loadSubscribers()
          }}
          className="mb-4 flex gap-2"
        >
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email…"
              className="w-full border border-slate-300 rounded-md pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="text-sm border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50">
            Search
          </button>
        </form>

        {subscribers.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <Mail size={32} className="mx-auto mb-3" />
            <p>No subscribers yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Lists</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Source</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Joined</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscribers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{s.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {[s.weekly_newsletter && 'Weekly', s.events_activities && 'Events'].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">{s.source || '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-500">
                      {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          s.status === 'subscribed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.status}
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}
