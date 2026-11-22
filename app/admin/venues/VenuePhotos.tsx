'use client'

import { useEffect, useState } from 'react'
import { X, Upload, ArrowLeft, ArrowRight, Trash2, ExternalLink } from 'lucide-react'

interface Props {
  venue: { id: number; name: string; city_slug: string; slug: string }
  onClose: () => void
}

/** Admin photo panel for one venue: upload, reorder (first = cover photo) and remove. Changes go live at once. */
export function VenuePhotos({ venue, onClose }: Props) {
  const [photos, setPhotos] = useState<string[]>([])
  const [limit, setLimit] = useState(4)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function apply(data: { photos?: string[]; limit?: number }) {
    setPhotos(data.photos ?? [])
    if (data.limit) setLimit(data.limit)
  }

  useEffect(() => {
    let live = true
    fetch(`/api/admin/venues/photos?venueId=${venue.id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!live) return
        if (!res.ok) setError(data.error || 'Could not load photos')
        else apply(data)
      })
      .catch(() => live && setError('Could not load photos'))
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [venue.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function upload(files: FileList) {
    setError('')
    setNotice('')
    const list = Array.from(files)
    let added = 0
    for (let i = 0; i < list.length; i++) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`)
      const fd = new FormData()
      fd.append('venueId', String(venue.id))
      fd.append('file', list[i])
      const res = await fetch('/api/admin/venues/photos', { method: 'POST', body: fd }).catch(() => null)
      const data = await res?.json().catch(() => ({}))
      if (!res?.ok) {
        setError(`${list[i].name}: ${data?.error || 'upload failed'}`)
        break
      }
      apply(data)
      added++
    }
    setBusy('')
    if (added) setNotice(`${added} photo${added === 1 ? '' : 's'} added. ${added === 1 ? 'It is' : 'They are'} live on the venue page now.`)
  }

  async function save(next: string[], message: string) {
    setError('')
    setNotice('')
    setBusy('Saving…')
    const res = await fetch('/api/admin/venues/photos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId: venue.id, photos: next }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy('')
    if (!res?.ok) { setError(data?.error || 'Could not save'); return }
    apply(data)
    setNotice(message)
  }

  function move(i: number, by: -1 | 1) {
    const next = [...photos]
    const j = i + by
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next, 'Order saved.')
  }

  const full = photos.length >= limit

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="venue-photos-title">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 id="venue-photos-title" className="text-lg font-bold text-slate-900">Photos: {venue.name}</h2>
            <a
              href={`/soft-play/${venue.city_slug}/${venue.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline"
            >
              View venue page <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button onClick={onClose} disabled={!!busy} className="text-slate-400 hover:text-slate-700 disabled:opacity-40" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          {photos.length} of {limit} photos{limit < 12 ? ' (free plan; Premium allows 12)' : ''}. The first photo is the cover.
          Changes go live straight away and show in the owner&apos;s dashboard too. JPEG, PNG, WebP or HEIC, max 8MB each; location data is removed.
        </p>

        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
        ) : (
          <>
            {photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {photos.map((url, i) => (
                  <div key={url} className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full aspect-[4/3] object-cover" />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 rounded bg-purple-600 text-white text-[10px] font-semibold px-1.5 py-0.5">Cover</span>
                    )}
                    <div className="flex items-center justify-between bg-white/95 px-1.5 py-1">
                      <div className="flex gap-1">
                        <button type="button" disabled={!!busy || i === 0} onClick={() => move(i, -1)} className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30" aria-label="Move earlier">
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" disabled={!!busy || i === photos.length - 1} onClick={() => move(i, 1)} className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30" aria-label="Move later">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => save(photos.filter((_, j) => j !== i), 'Photo removed.')}
                        className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                        aria-label="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-6 text-center border-2 border-dashed border-slate-200 rounded-lg mb-4">No photos added yet.</p>
            )}

            <label className={`inline-flex items-center gap-2 text-sm font-medium text-white px-4 py-2 rounded-lg ${full || busy ? 'bg-slate-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 cursor-pointer'}`}>
              <Upload className="w-4 h-4" />
              {busy || (full ? 'Photo limit reached' : 'Upload photos')}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                disabled={full || !!busy}
                onChange={(e) => {
                  if (e.target.files?.length) upload(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
          </>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {notice && <p className="text-sm text-green-700 mt-3">{notice}</p>}
      </div>
    </div>
  )
}
