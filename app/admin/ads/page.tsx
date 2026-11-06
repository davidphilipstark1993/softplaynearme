'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Archive, ArchiveRestore, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { AdminUnavailable } from '@/components/admin/AdminUnavailable'
import { placementLabel } from '@/lib/ads/placements'
import type { AdminAd } from '@/lib/ads/types'
import { cn } from '@/lib/utils'
import { AdForm, EMPTY_DRAFT, draftFromAd, type AdDraft } from './AdForm'
import { AnalyticsPanel } from './AnalyticsPanel'

const STATE_STYLE: Record<AdminAd['liveState'], { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-green-100 text-green-800' },
  scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-800' },
  expired: { label: 'Expired', cls: 'bg-amber-100 text-amber-800' },
  paused: { label: 'Draft / paused', cls: 'bg-slate-100 text-slate-700' },
  archived: { label: 'Archived', cls: 'bg-slate-100 text-slate-400' },
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

export default function AdminAdsPage() {
  const [authed, setAuthed] = useState(false)
  const [dbError, setDbError] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [ads, setAds] = useState<AdminAd[]>([])
  const [cities, setCities] = useState<{ slug: string; name: string }[]>([])
  const [tab, setTab] = useState<'ads' | 'analytics'>('ads')
  const [form, setForm] = useState<{ draft: AdDraft; id: number | null } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [actionError, setActionError] = useState('')

  const load = useCallback(() => {
    setDbError(false)
    fetch('/api/admin/ads')
      .then(async (res) => {
        if (res.ok) {
          const d = await res.json()
          setAds(d.ads)
          setCities(d.cities)
          setAuthed(true)
        } else if (res.status !== 401) setDbError(true)
      })
      .catch(() => setDbError(true))
  }, [])

  useEffect(() => { load() }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: password }),
    })
    if (res.ok) load()
    else setLoginError('Incorrect password')
  }

  async function setStatus(ad: AdminAd, status: AdDraft['status']) {
    setActionError('')
    const res = await fetch(`/api/admin/ads/${ad.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) setActionError((await res.json().catch(() => ({}))).error || 'Update failed')
    load()
  }

  async function remove(ad: AdminAd) {
    if (!window.confirm(`Permanently delete "${ad.title}" and all its analytics?\n\nArchive instead if you may want the history. This cannot be undone.`)) return
    setActionError('')
    const res = await fetch(`/api/admin/ads/${ad.id}`, { method: 'DELETE' })
    if (!res.ok) setActionError('Delete failed')
    load()
  }

  if (dbError) return <AdminUnavailable onRetry={load} />

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-xl">
          <h1 className="text-xl font-bold text-slate-900 mb-6 text-center">Admin Access</h1>
          <form onSubmit={login} className="space-y-4">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" className="w-full border border-slate-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700" autoFocus />
            {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-slate-900 text-white font-semibold py-3 rounded-lg text-sm hover:bg-slate-800 transition-colors">Sign in</button>
          </form>
        </div>
      </div>
    )
  }

  const visible = ads.filter((a) => showArchived || a.status !== 'archived')
  const archivedCount = ads.filter((a) => a.status === 'archived').length

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Advertisements</h1>
            <p className="text-sm text-slate-500">Cross-promote your other sites — no code needed.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-slate-500 hover:underline">← Admin home</Link>
            {!form && (
              <button onClick={() => { setTab('ads'); setForm({ draft: EMPTY_DRAFT, id: null }) }} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                <Plus className="h-4 w-4" /> New advert
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 flex gap-1 border-b border-slate-200" role="tablist">
          {(['ads', 'analytics'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === t ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
              {t === 'ads' ? 'Adverts' : 'Analytics'}
            </button>
          ))}
        </div>

        {tab === 'analytics' ? (
          <AnalyticsPanel />
        ) : (
          <>
            {form && (
              <AdForm
                key={form.id ?? 'new'}
                initial={form.draft}
                editingId={form.id}
                cities={cities}
                onSaved={() => { setForm(null); load() }}
                onCancel={() => setForm(null)}
              />
            )}

            {actionError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                No adverts yet. Click <strong>New advert</strong> to promote Listen True Crime, AI Founder Files or anything else.
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((ad) => {
                  const st = STATE_STYLE[ad.liveState]
                  const ctr = ad.impressions30d ? ((ad.clicks30d / ad.impressions30d) * 100).toFixed(1) + '%' : '–'
                  return (
                    <li key={ad.id} className={cn('flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row', ad.status === 'archived' && 'opacity-60')}>
                      {ad.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.imageUrl} alt={ad.imageAlt} width={1280} height={720} className="aspect-video w-full rounded-lg object-cover sm:w-44 sm:shrink-0" />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 sm:w-44 sm:shrink-0">No artwork</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-900">{ad.title}</h2>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', st.cls)}>{st.label}</span>
                          {ad.advertiserType === 'sponsor' && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-800">Sponsor</span>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{ad.advertiserName} · {ad.destinationUrl}</p>
                        <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {ad.placements.length === 0 ? <span className="text-amber-700">No placements chosen</span> : ad.placements.map((p) => (
                            <span key={p} className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-800">{placementLabel(p)}</span>
                          ))}
                          {ad.citySlugs.length > 0 && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{ad.citySlugs.length} cit{ad.citySlugs.length === 1 ? 'y' : 'ies'}</span>}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          Priority {ad.priority}
                          {ad.startsAt && ` · from ${fmtDate(ad.startsAt)}`}
                          {ad.endsAt && ` · until ${fmtDate(ad.endsAt)}`}
                          {' · '}<span className="tabular-nums">{ad.impressions30d.toLocaleString('en-GB')} impressions · {ad.clicks30d.toLocaleString('en-GB')} clicks · {ctr} CTR</span> (30d)
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-1 sm:flex-col sm:items-stretch">
                        <button onClick={() => { setTab('ads'); setForm({ draft: draftFromAd(ad), id: ad.id }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /> Edit / preview</button>
                        {ad.status === 'active' && <button onClick={() => setStatus(ad, 'draft')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Pause className="h-3.5 w-3.5" /> Unpublish</button>}
                        {ad.status === 'draft' && <button onClick={() => setStatus(ad, 'active')} className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"><Play className="h-3.5 w-3.5" /> Publish</button>}
                        {ad.status === 'archived'
                          ? <button onClick={() => setStatus(ad, 'draft')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><ArchiveRestore className="h-3.5 w-3.5" /> Restore</button>
                          : <button onClick={() => setStatus(ad, 'archived')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><Archive className="h-3.5 w-3.5" /> Archive</button>}
                        <button onClick={() => remove(ad)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {archivedCount > 0 && (
              <button onClick={() => setShowArchived((v) => !v)} className="mt-4 text-sm text-slate-500 hover:underline">
                {showArchived ? 'Hide' : 'Show'} {archivedCount} archived
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
