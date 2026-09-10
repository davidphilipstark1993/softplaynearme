'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type LoadState = 'loading' | 'ready' | 'not_found'

export function PreferencesForm({ token }: { token: string }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [email, setEmail] = useState('')
  const [weekly, setWeekly] = useState(false)
  const [events, setEvents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/newsletter/preferences?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setEmail(data.email)
        setWeekly(data.weeklyNewsletter)
        setEvents(data.eventsActivities)
        setLoadState('ready')
      })
      .catch(() => setLoadState('not_found'))
  }, [token])

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, weeklyNewsletter: weekly, eventsActivities: events }),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (loadState === 'loading') {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (loadState === 'not_found') {
    return (
      <p className="text-center text-sm text-slate-500 py-6">
        We couldn&rsquo;t find that subscription. The link may have expired — email{' '}
        <a href="mailto:hello@softplaynearme.co.uk" className="text-purple-600 underline">
          hello@softplaynearme.co.uk
        </a>{' '}
        for help.
      </p>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-500 mb-4">
        Managing preferences for <span className="font-medium text-slate-700">{email}</span>
      </p>

      <div className="space-y-3">
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
          <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} className="mt-0.5 rounded" />
          <span>
            <span className="block text-sm font-medium text-slate-900">Weekly Soft Play Near Me newsletter</span>
            <span className="block text-xs text-slate-500">Venue picks, activities and family day-out ideas every Sunday.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
          <input type="checkbox" checked={events} onChange={(e) => setEvents(e.target.checked)} className="mt-0.5 rounded" />
          <span>
            <span className="block text-sm font-medium text-slate-900">Family events & activities</span>
            <span className="block text-xs text-slate-500">School holiday events, offers and things to do with the kids.</span>
          </span>
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className={cn(
          'mt-5 w-full rounded-md py-2.5 text-sm font-semibold text-white transition-all',
          'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600',
          'disabled:cursor-not-allowed disabled:opacity-60'
        )}
      >
        {saving ? 'Saving…' : 'Save preferences'}
      </button>

      {saved && <p className="mt-3 text-center text-xs text-green-600">Preferences saved.</p>}
      {!weekly && !events && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Unchecking both lists will unsubscribe you from all Soft Play Near Me emails.
        </p>
      )}
    </div>
  )
}
