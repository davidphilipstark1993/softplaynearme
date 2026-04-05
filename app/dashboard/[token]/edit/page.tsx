'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Input } from '@/components/ui/input'
import { computeCompleteness } from '@/lib/completeness'
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

const FACILITIES = [
  { key: 'cafe', label: 'Café / Food & Drink' },
  { key: 'parking', label: 'Free Parking' },
  { key: 'parties', label: 'Birthday Parties' },
  { key: 'toddler_area', label: 'Toddler Area' },
  { key: 'baby_area', label: 'Baby / Under 1s Area' },
  { key: 'sen_friendly', label: 'SEN Sessions' },
  { key: 'wheelchair_access', label: 'Wheelchair Accessible' },
  { key: 'has_outdoor_play', label: 'Outdoor Play Area' },
  { key: 'free_wifi', label: 'Free WiFi' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormState = Record<string, any>

export default function EditPage() {
  const params = useParams()
  const token = params.token as string
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [claim, setClaim] = useState<any>(null)
  const [form, setForm] = useState<FormState>({})
  const [hours, setHours] = useState<Record<string, { open: string; close: string } | null>>({})

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
          })
          // Parse opening hours
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
        } else {
          // Pre-fill from claim data
          setForm({
            name: c.venue_name || '',
            address: c.venue_address || '',
            phone: c.venue_phone || '',
            website: c.venue_website || '',
            postcode: '', description: '', price_from: '', price_to: '',
            price_range: '', main_image_url: '',
            cafe: false, parking: false, parties: false, toddler_area: false,
            baby_area: false, sen_friendly: false, wheelchair_access: false,
            has_outdoor_play: false, free_wifi: false,
          })
          const oh: Record<string, null> = {}
          for (const day of DAYS) oh[day] = null
          setHours(oh)
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
    setSaved(false)
    setError('')

    // Build opening_hours from state
    const opening_hours: Record<string, { open: string; close: string } | null> = {}
    for (const day of DAYS) {
      opening_hours[day] = hours[day] || null
    }

    try {
      const res = await fetch(`/api/dashboard/${token}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, opening_hours }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function setField(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const { score } = computeCompleteness(
    claim && Object.keys(form).length > 0 ? { ...form, opening_hours: hours } : null
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
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm text-slate-500">
              <span className="font-semibold text-purple-600">{score}%</span> complete
            </div>
            {/* Inline progress bar */}
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
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
            <Field label="Website">
              <Input type="url" value={form.website || ''} onChange={(e) => setField('website', e.target.value)} placeholder="https://yourvenue.co.uk" />
            </Field>
          </Section>

          {/* DESCRIPTION */}
          <Section id="description" title="Description" emoji="📝">
            <Field label="Venue description" hint="2–4 sentences work best">
              <textarea
                value={form.description || ''}
                onChange={(e) => setField('description', e.target.value)}
                rows={5}
                maxLength={3000}
                placeholder="Tell parents what makes your soft play special — the size, age ranges, party rooms, café, what parents love about it…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 resize-none"
              />
              <p className="text-xs text-slate-400 mt-1">{(form.description || '').length} / 3000</p>
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
                    {/* Open/closed toggle */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
              {FACILITIES.map((f) => (
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
          </Section>

          {/* PRICING */}
          <Section id="pricing" title="Pricing" emoji="💷">
            <div className="grid gap-4 sm:grid-cols-3">
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
          </Section>

          {/* PHOTOS */}
          <Section id="photos" title="Main Photo" emoji="📸">
            <Field label="Main image URL" hint="paste a direct image URL or link from your website">
              <Input
                type="url"
                value={form.main_image_url || ''}
                onChange={(e) => setField('main_image_url', e.target.value)}
                placeholder="https://yourvenue.co.uk/images/soft-play.jpg"
              />
            </Field>
            <p className="text-xs text-slate-400 mt-1">
              Full photo upload coming soon. For now, paste a URL to an image hosted on your website.
            </p>
          </Section>

          {/* Save / feedback */}
          <div className="sticky bottom-0 -mx-4 px-4 py-4 bg-white border-t border-slate-200 flex items-center gap-4">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Saved!
              </span>
            )}
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
