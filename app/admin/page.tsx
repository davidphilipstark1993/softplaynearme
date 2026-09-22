'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Mail, Users, Building2, FileCheck2, BarChart3 } from 'lucide-react'
import { AdminUnavailable } from '@/components/admin/AdminUnavailable'

const SECTIONS = [
  { href: '/admin/newsletter', label: 'Newsletter', desc: "This week's issue, approvals, send history", icon: Mail },
  { href: '/admin/newsletter/subscribers', label: 'Newsletter Subscribers', desc: 'Subscriber list, stats, SendGrid sync', icon: Users },
  { href: '/admin/venues', label: 'Venues & Plans', desc: 'Manage listings, plans, featured placement', icon: Building2 },
  { href: '/admin/claims', label: 'Claims', desc: 'Venue ownership claims awaiting review', icon: FileCheck2 },
  { href: '/admin/insights', label: 'Insights', desc: 'Monthly stats, renewals, slipping listings', icon: BarChart3 },
]

export default function AdminHomePage() {
  const [authed, setAuthed] = useState(false)
  const [dbError, setDbError] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Reuses the venues endpoint purely to check for an existing valid admin_session cookie —
  // every /admin/* API route shares the same auth, so any one of them works as a probe.
  // A non-401 failure (e.g. the DB rejecting queries once its usage quota is exhausted,
  // see lib/pool.ts) is a different problem from "not logged in" — surface it as such
  // instead of bouncing a still-valid session back to the password wall.
  const probe = useCallback(() => {
    setDbError(false)
    fetch('/api/admin/venues')
      .then((res) => {
        if (res.ok) setAuthed(true)
        else if (res.status !== 401) setDbError(true)
      })
      .catch(() => setDbError(true))
  }, [])

  useEffect(() => {
    probe()
  }, [probe])

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
    } else {
      setLoginError('Incorrect password')
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
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin</h1>
        <p className="text-slate-500 text-sm mb-6">Soft Play Near Me</p>

        <div className="grid sm:grid-cols-2 gap-3">
          {SECTIONS.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-colors flex items-start gap-3"
            >
              <Icon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 text-sm">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
