'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Monitor, Smartphone } from 'lucide-react'
import { AdCard } from '@/components/ads/AdCard'
import { ALL_PLACEMENTS, CITY_TARGETABLE, PLACEMENTS } from '@/lib/ads/placements'
import type { AdminAd } from '@/lib/ads/types'
import { cn } from '@/lib/utils'

export interface AdDraft {
  title: string
  description: string
  ctaText: string
  destinationUrl: string
  imageUrl: string | null
  imageAlt: string
  advertiserName: string
  advertiserType: 'house' | 'sponsor'
  utmCampaign: string
  status: 'draft' | 'active' | 'archived'
  startsAt: string | null
  endsAt: string | null
  priority: number
  placements: string[]
  citySlugs: string[]
}

export const EMPTY_DRAFT: AdDraft = {
  title: '',
  description: '',
  ctaText: 'Learn more',
  destinationUrl: '',
  imageUrl: null,
  imageAlt: '',
  advertiserName: '',
  advertiserType: 'house',
  utmCampaign: '',
  status: 'draft',
  startsAt: null,
  endsAt: null,
  priority: 0,
  placements: [],
  citySlugs: [],
}

export function draftFromAd(ad: AdminAd): AdDraft {
  const { id, createdAt, updatedAt, liveState, impressions30d, clicks30d, ...rest } = ad
  void id; void createdAt; void updatedAt; void liveState; void impressions30d; void clicks30d
  return rest
}

// <input type="datetime-local"> works in the admin's local clock; stored as an ISO instant.
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
const labelCls = 'block text-sm font-medium text-slate-700 mb-1'

export function AdForm({
  initial,
  editingId,
  cities,
  onSaved,
  onCancel,
}: {
  initial: AdDraft
  editingId: number | null
  cities: { slug: string; name: string }[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<AdDraft>(initial)
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewVariant, setPreviewVariant] = useState<'banner' | 'card'>('banner')
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof AdDraft>(key: K, value: AdDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const everywhere = draft.placements.includes(ALL_PLACEMENTS)
  const cityApplies = everywhere || draft.placements.some((p) => CITY_TARGETABLE.includes(p))

  async function upload(file: File) {
    setError('')
    setUploadNote('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/ads/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      set('imageUrl', data.url)
      setUploadNote(
        data.cropped
          ? 'Optimised to 1280×720. Your image wasn\'t 16:9, so it was cropped to fit — check the preview.'
          : 'Optimised to 1280×720 WebP.'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function togglePlacement(key: string) {
    setDraft((d) => {
      if (key === ALL_PLACEMENTS) return { ...d, placements: d.placements.includes(ALL_PLACEMENTS) ? [] : [ALL_PLACEMENTS] }
      const without = d.placements.filter((p) => p !== ALL_PLACEMENTS)
      return { ...d, placements: without.includes(key) ? without.filter((p) => p !== key) : [...without, key] }
    })
  }

  async function save(statusOverride?: AdDraft['status']) {
    setError('')
    setSaving(true)
    try {
      const body = { ...draft, status: statusOverride ?? draft.status, priority: Number(draft.priority) || 0 }
      const res = await fetch(editingId ? `/api/admin/ads/${editingId}` : '/api/admin/ads', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Save failed')
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const previewReady = draft.title && draft.imageUrl
  const placeholder =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#e2e8f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="40" fill="#94a3b8" text-anchor="middle">Artwork preview (16:9)</text></svg>'
    )

  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-5 text-lg font-bold text-slate-900">{editingId ? 'Edit advert' : 'New advert'}</h2>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Form ── */}
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Artwork (16:9 landscape, JPEG/PNG/WebP, up to 4MB)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:border-purple-400 hover:bg-purple-50 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? 'Uploading…' : draft.imageUrl ? 'Replace image' : 'Choose an image from your computer'}
            </button>
            {uploadNote && <p className="mt-1 text-xs text-slate-500">{uploadNote}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="ad-alt">Image alt text</label>
            <input id="ad-alt" className={inputCls} maxLength={200} value={draft.imageAlt} onChange={(e) => set('imageAlt', e.target.value)} placeholder="Describe the artwork for screen readers" />
          </div>

          <div>
            <label className={labelCls} htmlFor="ad-title">Title <span className="font-normal text-slate-400">({draft.title.length}/120)</span></label>
            <input id="ad-title" className={inputCls} maxLength={120} value={draft.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div>
            <label className={labelCls} htmlFor="ad-desc">Description <span className="font-normal text-slate-400">({draft.description.length}/300 — keep it short)</span></label>
            <textarea id="ad-desc" rows={3} className={inputCls} maxLength={300} value={draft.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ad-cta">Button text</label>
              <input id="ad-cta" className={inputCls} maxLength={40} value={draft.ctaText} onChange={(e) => set('ctaText', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ad-priority">Priority (0–100, higher shows first)</label>
              <input id="ad-priority" type="number" min={0} max={100} className={inputCls} value={draft.priority} onChange={(e) => set('priority', Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="ad-url">Destination URL</label>
            <input id="ad-url" type="url" className={inputCls} value={draft.destinationUrl} onChange={(e) => set('destinationUrl', e.target.value)} placeholder="https://listentruecrime.com" />
            <p className="mt-1 text-xs text-slate-500">UTM tags (source=softplaynearme, medium, campaign, content=placement) are added automatically on click.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ad-adv">Advertiser</label>
              <input id="ad-adv" className={inputCls} maxLength={120} value={draft.advertiserName} onChange={(e) => set('advertiserName', e.target.value)} placeholder="Listen True Crime" />
            </div>
            <div>
              <label className={labelCls} htmlFor="ad-type">Advertiser type</label>
              <select id="ad-type" className={inputCls} value={draft.advertiserType} onChange={(e) => set('advertiserType', e.target.value as AdDraft['advertiserType'])}>
                <option value="house">My own site (&ldquo;More from us&rdquo;)</option>
                <option value="sponsor">Paying sponsor (&ldquo;Sponsored&rdquo;, rel=sponsored)</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="ad-utm">UTM campaign name <span className="font-normal text-slate-400">(optional — defaults to the title)</span></label>
            <input id="ad-utm" className={inputCls} maxLength={80} value={draft.utmCampaign} onChange={(e) => set('utmCampaign', e.target.value.toLowerCase())} placeholder="listen-true-crime" />
          </div>

          <fieldset>
            <legend className={labelCls}>Where should it appear?</legend>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <label className="flex items-start gap-2 text-sm font-medium text-slate-900">
                <input type="checkbox" className="mt-1" checked={everywhere} onChange={() => togglePlacement(ALL_PLACEMENTS)} />
                <span>Everywhere <span className="font-normal text-slate-500">— every placement, including any added later</span></span>
              </label>
              <hr className="border-slate-100" />
              {PLACEMENTS.map((p) => (
                <label key={p.key} className={cn('flex items-start gap-2 text-sm text-slate-700', everywhere && 'opacity-50')}>
                  <input type="checkbox" className="mt-1" disabled={everywhere} checked={everywhere || draft.placements.includes(p.key)} onChange={() => togglePlacement(p.key)} />
                  <span>{p.label}<span className="block text-xs text-slate-400">{p.hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          {cityApplies && (
            <div>
              <label className={labelCls} htmlFor="ad-cities">Limit to cities <span className="font-normal text-slate-400">(city &amp; venue pages only — leave empty for all cities)</span></label>
              <select
                id="ad-cities"
                multiple
                size={6}
                className={inputCls}
                value={draft.citySlugs}
                onChange={(e) => set('citySlugs', Array.from(e.target.selectedOptions).map((o) => o.value))}
              >
                {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">{draft.citySlugs.length ? `${draft.citySlugs.length} selected (Cmd/Ctrl-click to change)` : 'All cities'}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="ad-start">Start (optional)</label>
              <input id="ad-start" type="datetime-local" className={inputCls} value={toLocalInput(draft.startsAt)} onChange={(e) => set('startsAt', fromLocalInput(e.target.value))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="ad-end">End (optional)</label>
              <input id="ad-end" type="datetime-local" className={inputCls} value={toLocalInput(draft.endsAt)} onChange={(e) => set('endsAt', fromLocalInput(e.target.value))} />
            </div>
          </div>
        </div>

        {/* ── Live preview ── */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
            <div className="flex gap-2">
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs">
                {(['banner', 'card'] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setPreviewVariant(v)} className={cn('px-3 py-1.5', previewVariant === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600')}>
                    {v === 'banner' ? 'Banner' : 'Card'}
                  </button>
                ))}
              </div>
              <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs">
                <button type="button" aria-label="Desktop width" onClick={() => setPreviewWidth('desktop')} className={cn('px-3 py-1.5', previewWidth === 'desktop' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600')}><Monitor className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label="Mobile width" onClick={() => setPreviewWidth('mobile')} className={cn('px-3 py-1.5', previewWidth === 'mobile' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600')}><Smartphone className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-slate-100 p-4">
            <div className={cn('mx-auto', previewWidth === 'mobile' ? 'max-w-[360px]' : 'max-w-full')}>
              {/* Container query isn't needed: the banner switches layout at the md breakpoint, so force the stacked look by width. */}
              <div className={previewWidth === 'mobile' ? '[&_aside]:!block [&_aside_a:first-child]:!w-full' : ''}>
                <AdCard
                  preview
                  variant={previewVariant}
                  ad={{
                    title: draft.title || 'Your advert title',
                    description: draft.description || 'A short description of what you are promoting.',
                    ctaText: draft.ctaText || 'Learn more',
                    imageUrl: draft.imageUrl || placeholder,
                    imageAlt: draft.imageAlt,
                    label: draft.advertiserType === 'sponsor' ? 'Sponsored' : 'More from us',
                    sponsored: draft.advertiserType === 'sponsor',
                    href: '#',
                  }}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This is exactly what visitors see. {!previewReady && 'Add a title and artwork to complete the preview.'}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button type="button" disabled={saving} onClick={() => save('active')} className="rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
          {saving ? 'Saving…' : draft.status === 'active' && editingId ? 'Save changes' : 'Publish'}
        </button>
        <button type="button" disabled={saving} onClick={() => save('draft')} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          Save as draft
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2.5 text-sm text-slate-500 hover:underline">Cancel</button>
        <p className="text-xs text-slate-400">Published adverts go live within about a minute, inside their start/end dates.</p>
      </div>
    </div>
  )
}
