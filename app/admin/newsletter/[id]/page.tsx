'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, Trash2, Send, CheckCircle2, AlertTriangle, Clock, BadgeCheck } from 'lucide-react'
import type { Newsletter, NewsletterItem, NewsletterItemType, NewsletterSend, NewsletterStatus } from '@/lib/newsletter/types'
import { AdminUnavailable } from '@/components/admin/AdminUnavailable'

interface VenueResult {
  id: number
  name: string
  slug: string
  city_slug: string
  image_url: string | null
}

const ITEM_TYPE_LABELS: Record<NewsletterItemType, string> = {
  venue: 'Featured venue',
  event: 'Event / activity',
  offer: 'Offer / discount',
  news: 'Venue news',
  link: 'Useful link',
}

const STATUS_LABELS: Record<NewsletterStatus, string> = {
  draft: 'Draft',
  ready_for_review: 'Ready for review',
  approved: 'Approved for sending',
  sent: 'Sent',
  failed: 'Failed',
}

export default function AdminNewsletterEditorPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [authed, setAuthed] = useState(false)
  const [dbError, setDbError] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [items, setItems] = useState<NewsletterItem[]>([])
  const [sends, setSends] = useState<NewsletterSend[]>([])
  const [loading, setLoading] = useState(true)

  const [subject, setSubject] = useState('')
  const [introHtml, setIntroHtml] = useState('')
  const [weekOf, setWeekOf] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [transitionError, setTransitionError] = useState('')
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    setDbError(false)
    const res = await fetch(`/api/admin/newsletter/${id}`)
    if (res.status === 401) {
      setAuthed(false)
      return
    }
    if (!res.ok) {
      setDbError(true)
      return
    }
    setAuthed(true)
    const data = await res.json()
    setNewsletter(data.newsletter)
    setItems(data.items)
    setSends(data.sends)
    setSubject(data.newsletter.subject)
    setIntroHtml(data.newsletter.intro_html || '')
    setWeekOf(data.newsletter.week_of ? data.newsletter.week_of.slice(0, 10) : '')
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: password }),
    })
    if (res.ok) {
      load()
    } else {
      setLoginError('Incorrect password')
    }
  }

  async function saveDraft() {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch(`/api/admin/newsletter/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, introHtml, weekOf: weekOf || undefined }),
      })
      if (res.ok) {
        setSaveMsg('Saved')
        setTimeout(() => setSaveMsg(''), 2000)
        load()
      } else {
        const data = await res.json()
        setSaveMsg(data.error || 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  async function approveForSending() {
    if (!confirm('Approve this newsletter for Sunday sending? Editing anything afterwards will require re-approving.')) return
    setTransitionError('')
    const res = await fetch(`/api/admin/newsletter/${id}/status`, { method: 'POST' })
    if (res.ok) {
      load()
    } else {
      const data = await res.json()
      setTransitionError(data.error || 'Could not approve')
    }
  }

  async function sendNow() {
    if (!confirm('Send this newsletter to every eligible subscriber right now, instead of waiting for Sunday? This cannot be undone.')) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/newsletter/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setTransitionError(data.error || 'Send failed')
      }
      load()
    } finally {
      setSending(false)
    }
  }

  async function toggleApproval(itemId: number) {
    await fetch(`/api/admin/newsletter/items/${itemId}`, { method: 'PATCH' })
    load()
  }

  async function deleteItem(itemId: number) {
    if (!confirm('Remove this from the newsletter?')) return
    await fetch(`/api/admin/newsletter/items/${itemId}`, { method: 'DELETE' })
    load()
  }

  if (dbError) {
    return <AdminUnavailable onRetry={load} />
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

  if (loading || !newsletter) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading…</div>
  }

  const isEditable = newsletter.status !== 'sent'
  const latestSend = sends[0]
  const approvedVenueCount = items.filter((i) => i.item_type === 'venue' && i.approved).length
  const readyToApprove = approvedVenueCount === 5 && newsletter.status === 'ready_for_review'

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/admin/newsletter" className="text-sm text-slate-500 hover:underline">
            &larr; All newsletters
          </Link>
          <a
            href={`/api/admin/newsletter/${id}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:underline"
          >
            <Eye className="w-4 h-4" /> Preview
          </a>
        </div>

        <StatusBanner newsletter={newsletter} latestSend={latestSend} />

        {transitionError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {transitionError}
          </div>
        )}

        {/* Content editor */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject line</label>
            <input
              type="text"
              value={subject}
              disabled={!isEditable}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Week of</label>
              <input
                type="date"
                value={weekOf}
                disabled={!isEditable}
                onChange={(e) => setWeekOf(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="flex items-end text-xs text-slate-400">
              {newsletter.type === 'weekly' ? 'Weekly newsletter' : 'Events & offers email'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Intro (HTML allowed — kept simple, e.g. &lt;p&gt; tags)</label>
            <textarea
              value={introHtml}
              disabled={!isEditable}
              onChange={(e) => setIntroHtml(e.target.value)}
              rows={4}
              placeholder="<p>Morning! Here's what's on our radar this week...</p>"
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm font-mono disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {isEditable && (
            <div className="flex items-center gap-3">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save draft'}
              </button>
              {saveMsg && <span className="text-xs text-slate-500">{saveMsg}</span>}
            </div>
          )}
        </div>

        {/* Content items */}
        {isEditable && <ItemForm newsletterId={id} onAdded={load} />}

        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Content ({items.length} item{items.length === 1 ? '' : 's'})
            </h2>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${approvedVenueCount === 5 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {approvedVenueCount} / 5 venues ready
            </span>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">No content yet — add featured venues, events, offers, news or links above.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-purple-600">
                        {ITEM_TYPE_LABELS[item.item_type]}
                      </span>
                      {item.item_type === 'venue' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.approved ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {item.approved ? 'Approved' : 'Draft'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                  </div>
                  {isEditable && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.item_type === 'venue' && (
                        <button
                          onClick={() => toggleApproval(item.id)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                            item.approved ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {item.approved ? 'Unapprove' : 'Approve'}
                        </button>
                      )}
                      <button onClick={() => deleteItem(item.id)} className="text-slate-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Approval workflow */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Workflow</h2>
          <div className="flex flex-wrap gap-2">
            {readyToApprove && (
              <button onClick={approveForSending} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                <BadgeCheck className="w-4 h-4" /> Approve for Sunday Sending
              </button>
            )}
            {newsletter.status === 'approved' && (
              <button
                onClick={sendNow}
                disabled={sending}
                className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send now'}
              </button>
            )}
            {!readyToApprove && newsletter.status !== 'approved' && newsletter.status !== 'sent' && (
              <span className="text-xs text-slate-400 py-2">
                Approve exactly 5 venue picks above to unlock Sunday sending.
              </span>
            )}
          </div>
          {newsletter.status === 'approved' && (
            <p className="text-xs text-slate-400 mt-3">
              Approved{newsletter.approved_at ? ` on ${new Date(newsletter.approved_at).toLocaleString('en-GB')}` : ''}. The Sunday
              automated job will send this automatically — editing anything (including unapproving a venue) drops it back out of
              approved and requires re-approving. Use &ldquo;Send now&rdquo; only to send outside the schedule or retry.
            </p>
          )}
        </div>

        {/* Send history */}
        {sends.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Send history</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {sends.map((s) => (
                <li key={s.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium text-slate-900 capitalize">{s.status}</span>
                    <span className="text-slate-400"> &middot; {s.triggered_by} &middot; {new Date(s.started_at).toLocaleString('en-GB')}</span>
                    {s.status === 'completed' && (
                      <p className="text-xs text-slate-500">{s.sent_count} sent, {s.failed_count} failed of {s.total_recipients}</p>
                    )}
                    {s.error_message && <p className="text-xs text-red-600 mt-0.5">{s.error_message}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBanner({ newsletter, latestSend }: { newsletter: Newsletter; latestSend?: NewsletterSend }) {
  const config: Record<NewsletterStatus, { icon: React.ReactNode; className: string }> = {
    draft: { icon: <Clock className="w-4 h-4" />, className: 'bg-slate-100 text-slate-600' },
    ready_for_review: { icon: <Clock className="w-4 h-4" />, className: 'bg-amber-100 text-amber-700' },
    approved: { icon: <CheckCircle2 className="w-4 h-4" />, className: 'bg-blue-100 text-blue-700' },
    sent: { icon: <CheckCircle2 className="w-4 h-4" />, className: 'bg-green-100 text-green-700' },
    failed: { icon: <AlertTriangle className="w-4 h-4" />, className: 'bg-red-100 text-red-700' },
  }
  const c = config[newsletter.status]

  return (
    <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2 ${c.className}`}>
      {c.icon}
      {STATUS_LABELS[newsletter.status]}
      {newsletter.status === 'sent' && newsletter.sent_at && (
        <span className="font-normal">&middot; sent {new Date(newsletter.sent_at).toLocaleString('en-GB')}</span>
      )}
      {newsletter.status === 'failed' && latestSend?.error_message && (
        <span className="font-normal truncate">&middot; {latestSend.error_message}</span>
      )}
    </div>
  )
}

function ItemForm({ newsletterId, onAdded }: { newsletterId: string; onAdded: () => void }) {
  const [itemType, setItemType] = useState<NewsletterItemType>('venue')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [venueQuery, setVenueQuery] = useState('')
  const [venueResults, setVenueResults] = useState<VenueResult[]>([])
  const [selectedVenue, setSelectedVenue] = useState<VenueResult | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (itemType !== 'venue' || venueQuery.trim().length < 2) {
      setVenueResults([])
      return
    }
    const handle = setTimeout(() => {
      fetch(`/api/admin/newsletter/venue-search?q=${encodeURIComponent(venueQuery)}`)
        .then((r) => r.json())
        .then((d) => setVenueResults(d.venues || []))
    }, 250)
    return () => clearTimeout(handle)
  }, [venueQuery, itemType])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (itemType === 'venue' && !selectedVenue) {
      setError('Search for and select a venue first')
      return
    }

    setAdding(true)
    try {
      const res = await fetch(`/api/admin/newsletter/${newsletterId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType,
          venueId: selectedVenue?.id,
          title: itemType === 'venue' ? selectedVenue!.name : title,
          description,
          url: itemType === 'venue' ? undefined : url,
          citySlug: selectedVenue?.city_slug,
          imageUrl: selectedVenue?.image_url,
          eventDate: eventDate || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Could not add item')
        return
      }
      setTitle('')
      setDescription('')
      setUrl('')
      setEventDate('')
      setSelectedVenue(null)
      setVenueQuery('')
      onAdded()
    } finally {
      setAdding(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Add content</h2>
      <select
        value={itemType}
        onChange={(e) => {
          setItemType(e.target.value as NewsletterItemType)
          setSelectedVenue(null)
        }}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      >
        {(Object.keys(ITEM_TYPE_LABELS) as NewsletterItemType[]).map((t) => (
          <option key={t} value={t}>
            {ITEM_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      {itemType === 'venue' ? (
        <div>
          <input
            type="text"
            value={venueQuery}
            onChange={(e) => setVenueQuery(e.target.value)}
            placeholder="Search venues by name…"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {venueResults.length > 0 && (
            <ul className="mt-1 border border-slate-200 rounded-md divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {venueResults.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVenue(v)
                      setVenueQuery(v.name)
                      setVenueResults([])
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50"
                  >
                    {v.name} <span className="text-slate-400 text-xs">({v.city_slug})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedVenue && <p className="text-xs text-green-600 mt-1">Selected: {selectedVenue.name}</p>}
        </div>
      ) : (
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      )}

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description — check prices, dates & opening times before publishing"
        rows={2}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
      />

      {itemType !== 'venue' && (
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      )}

      {(itemType === 'event' || itemType === 'offer') && (
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button type="submit" disabled={adding} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
        {adding ? 'Adding…' : 'Add to newsletter'}
      </button>
    </form>
  )
}
