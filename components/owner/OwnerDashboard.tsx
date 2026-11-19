'use client'

import { useEffect, useState } from 'react'
import { gtagEvent } from '@/lib/gtag'
import type { OwnerData, OwnerEvent, OwnerHours } from '@/lib/ownerData'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const BADGE_IMG = 'https://www.softplaynearme.co.uk/badge/find-us-on-soft-play-near-me.svg'

interface Props {
  venueName: string
  venueUrl: string | null
  verified: boolean
  welcome: boolean
  initialData: OwnerData
  initialCompleteness: number
  citySlug: string
  venueSlug: string
  photoLimit: number
}

const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base'
const label = 'block text-sm font-medium text-slate-700 mb-1'

export function OwnerDashboard(props: Props) {
  const [tab, setTab] = useState<'listing' | 'badge'>(props.welcome ? 'badge' : 'listing')
  const [d, setD] = useState<OwnerData>(props.initialData)
  const [completeness, setCompleteness] = useState(props.initialCompleteness)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (props.welcome && props.verified) gtagEvent('claim_verified', { city_slug: props.citySlug, venue_slug: props.venueSlug })
  }, [props.welcome, props.verified, props.citySlug, props.venueSlug])

  const set = <K extends keyof OwnerData>(k: K, v: OwnerData[K]) => setD((prev) => ({ ...prev, [k]: v }))
  const price = (k: 'under_1s' | 'under_5s' | 'over_5s' | 'adults' | 'notes', v: string) =>
    setD((prev) => ({ ...prev, prices: { ...(prev.prices ?? {}), [k]: k === 'notes' ? v : v === '' ? null : Number(v) } }))
  const facility = (k: 'cafe' | 'parking' | 'baby_change' | 'accessible', v: string) =>
    setD((prev) => {
      const f = { ...(prev.facilities ?? {}) } as Record<string, boolean>
      if (v === '') delete f[k]
      else f[k] = v === 'yes'
      return { ...prev, facilities: f }
    })
  const hours = (day: (typeof DAYS)[number], part: 'open' | 'close' | 'closed', v: string | boolean) =>
    setD((prev) => {
      const h: OwnerHours = { ...(prev.opening_hours_override ?? {}) }
      if (part === 'closed') {
        if (v) h[day] = 'closed'
        else delete h[day]
      } else {
        const cur = h[day] && h[day] !== 'closed' ? (h[day] as { open: string; close: string }) : { open: '', close: '' }
        const next = { ...cur, [part]: String(v) }
        if (!next.open && !next.close) delete h[day]
        else h[day] = next
      }
      return { ...prev, opening_hours_override: h }
    })

  async function save() {
    setBusy(true)
    setMsg(null)
    // Half-filled hours rows aren't sent (the server would reject them).
    const oh = Object.fromEntries(Object.entries(d.opening_hours_override ?? {}).filter(([, v]) => v === 'closed' || (v && v.open && v.close)))
    const res = await fetch('/api/owner/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...d, opening_hours_override: oh }),
    }).catch(() => null)
    const out = res ? await res.json().catch(() => ({})) : {}
    setBusy(false)
    if (!res || !res.ok) return setMsg({ ok: false, text: out.error || 'Could not save. Please try again.' })
    setCompleteness(out.completeness ?? completeness)
    setMsg({ ok: true, text: out.changed?.length ? 'Saved. Your page is updated.' : 'Nothing had changed.' })
    if (out.changed?.length) gtagEvent('owner_edit_saved', { fields: out.changed.join(','), venue_slug: props.venueSlug })
  }

  async function upload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/owner/photo', { method: 'POST', body: fd }).catch(() => null)
    const out = res ? await res.json().catch(() => ({})) : {}
    setUploading(false)
    if (!res || !res.ok) return setMsg({ ok: false, text: out.error || 'Upload failed.' })
    set('photos', [...(d.photos ?? []), out.url].slice(0, props.photoLimit))
    setMsg({ ok: true, text: 'Photo added. Press Save to publish it.' })
  }

  const snippet = props.venueUrl
    ? `<a href="${props.venueUrl}"><img src="${BADGE_IMG}" alt="Find us on Soft Play Near Me" width="200" height="56"></a>`
    : ''

  async function signOut() {
    await fetch('/api/owner/signout', { method: 'POST' })
    window.location.href = '/owner/login'
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{props.venueName}</h1>
          {props.venueUrl && <a href={props.venueUrl} className="text-sm text-purple-700 underline" target="_blank" rel="noopener">View your page</a>}
        </div>
        <button onClick={signOut} className="text-sm text-slate-500 underline">Sign out</button>
      </div>

      {props.welcome && props.verified && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 text-green-900">
          <strong>Thanks, you&apos;re verified.</strong> Your page now shows a &quot;Verified by owner&quot; badge. Add your prices and sessions below, and grab your badge for your own website.
        </div>
      )}
      {!props.verified && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900">
          Thanks for confirming your email. We&apos;re checking your claim by hand and will email you within 1 working day. You can fill this in now, but it will only save once you&apos;re verified.
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-1"><span>Listing complete</span><span>{completeness}%</span></div>
        <div className="h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-purple-600" style={{ width: `${completeness}%` }} /></div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200">
        {(['listing', 'badge'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 -mb-px border-b-2 ${tab === t ? 'border-purple-600 text-purple-700 font-semibold' : 'border-transparent text-slate-600'}`}>
            {t === 'listing' ? 'Your listing' : 'Website badge'}
          </button>
        ))}
      </div>

      {tab === 'badge' ? (
        <section className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-lg mb-2">Add our badge to your website</h2>
          <p className="text-slate-600 mb-4">Paste this into your site&apos;s HTML. It links parents to your page on Soft Play Near Me.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/badge/find-us-on-soft-play-near-me.svg" alt="Find us on Soft Play Near Me" width={200} height={56} className="mb-4" />
          <textarea readOnly value={snippet} rows={3} className={`${field} font-mono text-xs`} />
          <button
            className="mt-3 rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white"
            onClick={async () => {
              await navigator.clipboard.writeText(snippet).catch(() => null)
              setCopied(true)
              gtagEvent('badge_snippet_copied', { venue_slug: props.venueSlug })
            }}
          >
            {copied ? 'Copied' : 'Copy code'}
          </button>
        </section>
      ) : (
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <label className={label}>About your venue (shown instead of our description, max 600 characters)</label>
            <textarea rows={5} maxLength={600} value={d.owner_description ?? ''} onChange={(e) => set('owner_description', e.target.value)} className={field} />
            <span className="text-xs text-slate-500">{(d.owner_description ?? '').length}/600</span>
          </div>

          <fieldset>
            <legend className={label}>Prices (£ per visit; 0 = free)</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([['under_1s', 'Under 1s'], ['under_5s', 'Under 5s'], ['over_5s', 'Over 5s'], ['adults', 'Adults']] as const).map(([k, l]) => (
                <label key={k} className="text-sm">{l}
                  <input type="number" min={0} max={200} step="0.01" value={d.prices?.[k] ?? ''} onChange={(e) => price(k, e.target.value)} className={field} />
                </label>
              ))}
            </div>
            <input placeholder="Notes, e.g. peak and off-peak prices, sibling discount" maxLength={200} value={d.prices?.notes ?? ''} onChange={(e) => price('notes', e.target.value)} className={`${field} mt-3`} />
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-3">
            <legend className={label}>Ages</legend>
            <label className="text-sm">From age<input type="number" min={0} max={18} value={d.age_min ?? ''} onChange={(e) => set('age_min', e.target.value === '' ? null : Number(e.target.value))} className={field} /></label>
            <label className="text-sm">Up to age<input type="number" min={0} max={18} value={d.age_max ?? ''} onChange={(e) => set('age_max', e.target.value === '' ? null : Number(e.target.value))} className={field} /></label>
          </fieldset>

          <fieldset>
            <legend className={label}>Opening hours (leave a day blank to keep what we have)</legend>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const v = d.opening_hours_override?.[day]
                const closed = v === 'closed'
                const o = v && v !== 'closed' ? v : { open: '', close: '' }
                return (
                  <div key={day} className="grid grid-cols-[6rem_1fr_1fr_auto] gap-2 items-center text-sm">
                    <span className="capitalize">{day}</span>
                    <input type="time" disabled={closed} value={o.open} onChange={(e) => hours(day, 'open', e.target.value)} className={field} />
                    <input type="time" disabled={closed} value={o.close} onChange={(e) => hours(day, 'close', e.target.value)} className={field} />
                    <label className="flex items-center gap-1"><input type="checkbox" checked={closed} onChange={(e) => hours(day, 'closed', e.target.checked)} />Closed</label>
                  </div>
                )
              })}
            </div>
          </fieldset>

          {([['toddler_sessions', 'Toddler sessions (days, times, price)'], ['sen_sessions', 'SEN or quiet sessions (days, times, what to expect)'], ['party_packages', 'Party packages (what is included, from £, minimum numbers)']] as const).map(([k, l]) => (
            <div key={k}>
              <label className={label}>{l}</label>
              <textarea rows={3} maxLength={k === 'party_packages' ? 600 : 400} value={d[k] ?? ''} onChange={(e) => set(k, e.target.value)} className={field} />
            </div>
          ))}

          <fieldset>
            <legend className={label}>Facilities</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([['cafe', 'Café'], ['parking', 'Parking'], ['baby_change', 'Baby change'], ['accessible', 'Wheelchair accessible']] as const).map(([k, l]) => (
                <label key={k} className="text-sm">{l}
                  <select value={d.facilities?.[k] === true ? 'yes' : d.facilities?.[k] === false ? 'no' : ''} onChange={(e) => facility(k, e.target.value)} className={field}>
                    <option value="">Not set</option><option value="yes">Yes</option><option value="no">No</option>
                  </select>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <span className={label}>Photos (up to {props.photoLimit}{props.photoLimit < 12 ? '; Premium allows 12' : ''}; JPEG, PNG, WebP or HEIC, max 8MB; location data is removed)</span>
            <div className="flex flex-wrap gap-2 mb-2">
              {(d.photos ?? []).map((u, i) => (
                <div key={u} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-20 w-28 object-cover rounded" />
                  <button type="button" onClick={() => set('photos', (d.photos ?? []).filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded bg-white/90 px-1 text-xs">Remove</button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" disabled={uploading || (d.photos?.length ?? 0) >= props.photoLimit} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {uploading && <span className="text-sm text-slate-500 ml-2">Uploading…</span>}
          </div>

          <div>
            <span className={label}>Events (holiday sessions, special days)</span>
            {(d.events ?? []).map((ev, i) => (
              <div key={i} className="grid sm:grid-cols-[1fr_10rem_auto] gap-2 mb-2">
                <input placeholder="Title" value={ev.title} maxLength={100} onChange={(e) => set('events', (d.events ?? []).map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className={field} />
                <input type="date" value={ev.date} onChange={(e) => set('events', (d.events ?? []).map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={field} />
                <button type="button" onClick={() => set('events', (d.events ?? []).filter((_, j) => j !== i))} className="text-sm underline">Remove</button>
                <input placeholder="Details (optional)" value={ev.description ?? ''} maxLength={300} onChange={(e) => set('events', (d.events ?? []).map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className={`${field} sm:col-span-3`} />
              </div>
            ))}
            <button type="button" onClick={() => set('events', [...(d.events ?? []), { title: '', date: '', description: '' } as OwnerEvent].slice(0, 12))} className="text-sm text-purple-700 underline">Add an event</button>
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`} role="status">{msg.text}</p>}
          <button onClick={save} disabled={busy || !props.verified} className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
            {busy ? 'Saving…' : 'Save and publish'}
          </button>
        </section>
      )}
    </div>
  )
}
