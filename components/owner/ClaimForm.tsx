'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { gtagEvent } from '@/lib/gtag'

const ROLES = ['Owner', 'Manager', 'Staff member', 'Marketing / agency']

export function ClaimForm({ citySlug, slug, venueName }: { citySlug: string; slug: string; venueName: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const f = new FormData(e.currentTarget)
    const res = await fetch('/api/owner/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citySlug, slug,
        name: f.get('name'), role: f.get('role'), email: f.get('email'), company: f.get('company'),
      }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      setBusy(false)
      return
    }
    gtagEvent('claim_submitted', { city_slug: citySlug, venue_slug: slug, method: data.method })
    router.push(`/claim/sent?method=${encodeURIComponent(data.method)}&venue=${encodeURIComponent(venueName)}`)
  }

  const input = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200'
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Your name</span>
        <input name="name" required maxLength={120} autoComplete="name" className={input} />
      </label>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Your role at {venueName}</span>
        <select name="role" required defaultValue="" className={input}>
          <option value="" disabled>Choose…</option>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Your work email</span>
        <input name="email" type="email" required maxLength={160} autoComplete="email" className={input} />
        <span className="block text-xs text-slate-500 mt-1">An address on your venue&apos;s website domain is verified straight away. Others are checked by hand within 1 working day.</span>
      </label>
      {/* honeypot */}
      <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-purple-600 px-4 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
        {busy ? 'Sending…' : 'Send my sign-in link'}
      </button>
      <p className="text-xs text-slate-500">Free, always. No password: we email you a link. See our <a href="/privacy" className="underline">privacy policy</a>.</p>
    </form>
  )
}
