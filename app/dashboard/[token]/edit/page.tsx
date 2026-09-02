'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Input } from '@/components/ui/input'
import { computeCompleteness } from '@/lib/completeness'
import { isUsablePhotoUrl } from '@/lib/imageUtils'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, Plus, Trash2, Eye, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const FACILITY_GROUPS = [
  {
    label: 'Food & Drink',
    items: [
      { key: 'cafe', label: 'Café / Food & Drink' },
      { key: 'food_served', label: 'Full Meals Served' },
    ],
  },
  {
    label: 'Play Areas',
    items: [
      { key: 'toddler_area', label: 'Toddler Area' },
      { key: 'baby_area', label: 'Baby / Under 1s Area' },
      { key: 'has_outdoor_play', label: 'Outdoor Play Area' },
      { key: 'role_play_area', label: 'Role Play Area' },
    ],
  },
  {
    label: 'Events & Parties',
    items: [
      { key: 'parties', label: 'Birthday Parties' },
      { key: 'party_rooms', label: 'Dedicated Party Rooms' },
      { key: 'sen_friendly', label: 'SEN Sessions' },
    ],
  },
  {
    label: 'Convenience',
    items: [
      { key: 'parking', label: 'Free Parking' },
      { key: 'wheelchair_access', label: 'Wheelchair Accessible' },
      { key: 'changing_facilities', label: 'Baby Changing Facilities' },
      { key: 'free_wifi', label: 'Free WiFi' },
      { key: 'air_conditioning', label: 'Air Conditioning' },
    ],
  },
]

const SESSION_TYPES = [
  'Standard Session',
  'Toddler Session (under 5s)',
  'Baby Session (under 1s)',
  'Weekend Session',
  'After-School Session',
  'Party Package',
  'SEN Session',
  'Family Bundle',
  'Other',
]

interface Session {
  type: string
  price_from: string
  price_to: string
  description: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormState = Record<string, any>

function wordCount(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

export default function EditPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [claim, setClaim] = useState<any>(null)
  const [form, setForm] = useState<FormState>({})
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>({})
  const [sessions, setSessions] = useState<Session[]>([])
  const [photoUrls, setPhotoUrls] = useState<string[]>([''])
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/dashboard/${token}`)
        if (!res.ok) { router.replace('/'); return }
        const { claim: c, venue: v } = await res.json()
        setClaim(c)
        if (v) {
          setForm({
            name: v.name || '',
            address: v.address || '',
            postcode: v.postcode || '',
            phone: v.phone || '',
            website: v.website || '',
            description: v.description || '',
            special_notes: v.special_notes || '',
            price_from: v.price_from ?? '',
            price_to: v.price_to ?? '',
            price_range: v.price_range || '',
            main_image_url: v.main_image_url || '',
            cafe: !!v.cafe,
            parking: !!v.parking,
            parties: !!v.parties,
            toddler_area: !!v.toddler_area,
            baby_area: !!v.baby_area,
            sen_friendly: !!v.sen_friendly,
            wheelchair_access: !!v.wheelchair_access,
            has_outdoor_play: !!v.has_outdoor_play,
            free_wifi: !!v.free_wifi,
            air_conditioning: !!v.air_conditioning,
            party_rooms: !!v.party_rooms,
            food_served: !!v.food_served,
            changing_facilities: !!v.changing_facilities,
            role_play_area: !!v.role_play_area,
          })

          // Opening hours
          const oh: Record<string, { open: string; close: string } | null> = {}
          for (const day of DAYS) {
            const raw = v.opening_hours?.[day]
            if (!raw) { oh[day] = null; continue }
            if (typeof raw === 'object' && raw.open) {
              oh[day] = { open: raw.open, close: raw.close || '17:00' }
            } else {
              oh[day] = null
            }
          }
          setHours(oh)

          // Session pricing
          if (Array.isArray(v.session_pricing) && v.session_pricing.length > 0) {
            setSessions(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              v.session_pricing.map((s: any) => ({
                type: s.type || 'Standard Session',
                price_from: s.price_from != null ? String(s.price_from) : '',
                price_to: s.price_to != null ? String(s.price_to) : '',
                description: s.description || '',
              }))
            )
          }

          // Photo URLs — dead/placeholder scraped URLs (expired Google session
          // photos, Google's own "no photo" icons) are dropped rather than
          // shown as an editable-but-broken field.
          const photos: string[] = []
          if (isUsablePhotoUrl(v.main_image_url)) photos.push(v.main_image_url)
          if (Array.isArray(v.photo_urls)) {
            for (const u of v.photo_urls) {
              if (isUsablePhotoUrl(u) && !photos.includes(u)) photos.push(u)
            }
          }
          if (Array.isArray(v.images)) {
            for (const u of v.images) {
              if (isUsablePhotoUrl(u) && !photos.includes(u)) photos.push(u)
            }
          }
          setPhotoUrls(photos.length > 0 ? photos : [''])
        } else {
          // Pre-fill from claim data
          setForm({
            name: c.venue_name || '',
            address: c.venue_address || '',
            phone: c.venue_phone || '',
            website: c.venue_website || '',
            postcode: '', description: '', special_notes: '',
            price_from: '', price_to: '', price_range: '', main_image_url: '',
            cafe: false, parking: false, parties: false, toddler_area: false,
            baby_area: false, sen_friendly: false, wheelchair_access: false,
            has_outdoor_play: false, free_wifi: false, air_conditioning: false,
            party_rooms: false, food_served: false, changing_facilities: false,
            role_play_area: false,
          })
          const oh: Record<string, null> = {}
          for (const day of DAYS) oh[day] = null
          setHours(oh)
          setPhotoUrls([''])
        }
      } catch {
        setError('Failed to load venue data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const opening_hours: Record<string, { open: string; close: string } | null> = {}
    for (const day of DAYS) {
      opening_hours[day] = hours[day] || null
    }

    // First URL becomes main_image_url, all go into photo_urls
    const cleanPhotos = photoUrls.filter((u) => u.trim() !== '')
    const main_image_url = cleanPhotos[0] || ''

    try {
      const res = await fetch(`/api/dashboard/${token}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          opening_hours,
          session_pricing: sessions,
          photo_urls: cleanPhotos,
          main_image_url,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Save failed')
      }
      toast.success(`Great! Your listing is now ${score}% complete — parents will love the new details.`, {
        icon: '🎉',
        duration: 5000,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function setField(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addSession() {
    setSessions((s) => [...s, { type: 'Standard Session', price_from: '', price_to: '', description: '' }])
  }

  function updateSession(i: number, field: keyof Session, value: string) {
    setSessions((s) => s.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  function removeSession(i: number) {
    setSessions((s) => s.filter((_, idx) => idx !== i))
  }

  function addPhotoUrl() {
    if (photoUrls.length < 10) setPhotoUrls((p) => [...p, ''])
  }

  function updatePhotoUrl(i: number, value: string) {
    setPhotoUrls((p) => p.map((u, idx) => idx === i ? value : u))
  }

  function removePhotoUrl(i: number) {
    setPhotoUrls((p) => {
      const next = p.filter((_, idx) => idx !== i)
      return next.length === 0 ? [''] : next
    })
  }

  async function handlePhotoFile(i: number, file: File) {
    setUploadingIndex(i)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/dashboard/${token}/upload`, { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      updatePhotoUrl(i, data.url)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Photo upload failed')
    } finally {
      setUploadingIndex(null)
    }
  }

  const descWords = wordCount(form.description || '')

  const { score } = computeCompleteness(
    claim && Object.keys(form).length > 0
      ? { ...form, opening_hours: hours, session_pricing: sessions, photo_urls: photoUrls.filter(Boolean) }
      : null
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Top nav */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={`/dashboard/${token}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="ml-auto flex items-center gap-3">
            {/* Preview public page — only shown once a venue is linked */}
            {claim?.city_slug && claim?.venue_slug && (
              <a
                href={`/soft-play/${claim.city_slug}/${claim.venue_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Preview page
              </a>
            )}
            <div className="text-sm text-slate-500">
              <span className="font-semibold text-purple-600">{score}%</span> complete
            </div>
            <div className="hidden sm:block w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          {/* BASIC INFO */}
          <Section id="basic" title="Basic Info" emoji="📍">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Venue name" required>
                <Input value={form.name || ''} onChange={(e) => setField('name', e.target.value)} required maxLength={255} />
              </Field>
              <Field label="Phone number">
                <Input type="tel" value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} maxLength={30} placeholder="01234 567890" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address">
                <Input value={form.address || ''} onChange={(e) => setField('address', e.target.value)} maxLength={500} placeholder="123 High Street, Hull" />
              </Field>
              <Field label="Postcode">
                <Input value={form.postcode || ''} onChange={(e) => setField('postcode', e.target.value.toUpperCase())} maxLength={10} placeholder="HU1 1AA" />
              </Field>
            </div>
            <Field label="Website" hint="include https://">
              <Input type="url" value={form.website || ''} onChange={(e) => setField('website', e.target.value)} placeholder="https://yourvenue.co.uk" />
            </Field>
          </Section>

          {/* DESCRIPTION */}
          <Section id="description" title="Description" emoji="📝">
            <Field
              label="Venue description"
              hint={descWords >= 80 ? '✓ 80+ words — great!' : `${descWords}/80 words — aim for 80+`}
            >
              <textarea
                value={form.description || ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={6}
                maxLength={3000}
                placeholder="Tell parents what makes your soft play special — the size, age ranges, party rooms, café, what parents love about it…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-none"
              />
              <div className="flex justify-between mt-1">
                <p className={cn('text-xs', descWords >= 80 ? 'text-green-600 font-medium' : 'text-slate-400')}>
                  {descWords} words
                </p>
                <p className="text-xs text-slate-400">{(form.description || '').length} / 3000 chars</p>
              </div>
            </Field>
            <Field label="Special notes" hint="seasonal hours, SEN session details, upcoming events…">
              <textarea
                value={form.special_notes || ''}
                onChange={(e) => setField('special_notes', e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. 'Easter 2026 hours: open daily 10am–5pm' or 'SEN sessions every Tuesday 9–11am — booking required'"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{(form.special_notes || '').length} / 1000</p>
            </Field>
          </Section>

          {/* OPENING HOURS */}
          <Section id="hours" title="Opening Hours" emoji="🕐">
            <div className="space-y-2">
              {DAYS.map((day) => {
                const dayHours = hours[day]
                const isOpen = dayHours !== null
                return (
                  <div key={day} className="flex items-center gap-3">
                    <label className="flex items-center gap-2 w-24 flex-shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) =>
                          setHours((h) => ({
                            ...h,
                            [day]: e.target.checked ? { open: '09:30', close: '17:30' } : null,
                          }))
                        }
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className={cn('text-sm font-medium', isOpen ? 'text-slate-800' : 'text-slate-400')}>
                        {DAY_LABELS[day]}
                      </span>
                    </label>

                    {isOpen ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={dayHours?.open || '09:30'}
                          onChange={(e) =>
                            setHours((h) => ({ ...h, [day]: { open: e.target.value, close: h[day]?.close || '17:30' } }))
                          }
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                        <span className="text-slate-400 text-sm">to</span>
                        <input
                          type="time"
                          value={dayHours?.close || '17:30'}
                          onChange={(e) =>
                            setHours((h) => ({ ...h, [day]: { open: h[day]?.open || '09:30', close: e.target.value } }))
                          }
                          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Closed</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>

          {/* FACILITIES */}
          <Section id="facilities" title="Facilities" emoji="✅">
            <div className="space-y-5">
              {FACILITY_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">{group.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-6">
                    {group.items.map((f) => (
                      <label key={f.key} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!form[f.key]}
                          onChange={(e) => setField(f.key, e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className={cn('text-sm', form[f.key] ? 'font-medium text-slate-900' : 'text-slate-600 group-hover:text-slate-800')}>
                          {f.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* PRICING */}
          <Section id="pricing" title="Pricing" emoji="💷">
            {/* General price range */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <Field label="Price from (£)">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.price_from ?? ''}
                  onChange={(e) => setField('price_from', e.target.value)}
                  placeholder="e.g. 6"
                />
              </Field>
              <Field label="Price to (£)">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.price_to ?? ''}
                  onChange={(e) => setField('price_to', e.target.value)}
                  placeholder="e.g. 9"
                />
              </Field>
              <Field label="Price summary">
                <Input
                  value={form.price_range || ''}
                  onChange={(e) => setField('price_range', e.target.value)}
                  placeholder="e.g. £6–£9 per child"
                  maxLength={100}
                />
              </Field>
            </div>

            {/* Session pricing table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-slate-700">Session types</p>
                <button
                  type="button"
                  onClick={addSession}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Add session
                </button>
              </div>

              {sessions.length === 0 && (
                <p className="text-sm text-slate-400 italic">
                  No session types added yet. Click &ldquo;Add session&rdquo; to add pricing for Standard, Toddler, Party, and other sessions.
                </p>
              )}

              <div className="space-y-3">
                {sessions.map((session, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-2 mb-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Session type</label>
                        <select
                          value={session.type}
                          onChange={(e) => updateSession(i, 'type', e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                        >
                          {SESSION_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSession(i)}
                        className="mt-5 p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove session"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Price from (£)</label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={session.price_from}
                          onChange={(e) => updateSession(i, 'price_from', e.target.value)}
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Price to (£)</label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={session.price_to}
                          onChange={(e) => updateSession(i, 'price_to', e.target.value)}
                          placeholder="e.g. 8"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                      <Input
                        value={session.description}
                        onChange={(e) => updateSession(i, 'description', e.target.value)}
                        placeholder="e.g. includes soft play + lunch, booking required"
                        maxLength={300}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* PHOTOS */}
          <Section id="photos" title="Photos" emoji="📸">
            <p className="text-sm text-slate-500 mb-4">
              Listings with 3+ photos get 3× more clicks. Upload photos from your device, or paste a URL to an image already hosted online.
            </p>

            <div className="space-y-2.5">
              {photoUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-shrink-0 w-6 text-center text-xs font-medium text-slate-400">
                    {i + 1}
                  </div>
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      className="w-9 h-9 rounded object-cover flex-shrink-0 border border-slate-200"
                    />
                  )}
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => updatePhotoUrl(i, e.target.value)}
                    placeholder="https://yourvenue.co.uk/images/soft-play.jpg"
                    className="flex-1"
                  />
                  <label
                    className={cn(
                      'flex-shrink-0 p-1.5 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer',
                      uploadingIndex === i && 'pointer-events-none'
                    )}
                    title="Upload photo from your device"
                  >
                    {uploadingIndex === i ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePhotoFile(i, file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {photoUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhotoUrl(i)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {photoUrls.length < 10 && (
              <button
                type="button"
                onClick={addPhotoUrl}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                <Plus className="w-4 h-4" /> Add another photo
              </button>
            )}

            {photoUrls.filter(Boolean).length > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                First photo will be used as the main listing image. Max 4MB per photo.
              </p>
            )}
          </Section>

          {/* Save / feedback */}
          <div className="sticky bottom-0 -mx-4 px-4 py-4 bg-white border-t border-slate-200 flex items-center gap-4">
            {error && (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {error}
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <Link href={`/dashboard/${token}`} className="text-sm text-slate-500 hover:text-slate-800">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
      <Footer />
    </div>
  )
}

function Section({
  id,
  title,
  emoji,
  children,
}: {
  id: string
  title: string
  emoji: string
  children: React.ReactNode
}) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h2 className="font-semibold text-slate-900 text-lg mb-5 flex items-center gap-2">
        <span>{emoji}</span>
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
        {hint && <span className="font-normal text-slate-400 ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
