'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ClaimVenueFormProps {
  prefilledVenue?: string
  citySlug?: string
  venueSlug?: string
  venueUrl?: string
}

export function ClaimVenueForm({
  prefilledVenue = '',
  citySlug = '',
  venueSlug = '',
  venueUrl = '',
}: ClaimVenueFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get('name'),
      email: fd.get('email'),
      venueName: fd.get('venueName'),
      venueAddress: fd.get('venueAddress'),
      venuePhone: fd.get('venuePhone'),
      venueWebsite: fd.get('venueWebsite'),
      citySlug: citySlug || null,
      venueSlug: venueSlug || null,
      venueUrl: venueUrl || null,
    }

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'listing_claimed', {
        city_slug: citySlug || undefined,
        venue_slug: venueSlug || undefined,
        is_new_venue: !citySlug || !venueSlug,
      })
      router.push(`/add-venue/success?token=${data.token}`)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again or email hello@softplaynearme.co.uk'
      )
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row 1: Name + Email */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <Input name="name" required placeholder="Jane Smith" maxLength={100} />
        </Field>
        <Field label="Your email" required>
          <Input name="email" type="email" required placeholder="you@yourvenue.co.uk" maxLength={150} />
        </Field>
      </div>

      {/* Venue name */}
      <Field label="Venue name" required>
        <Input
          name="venueName"
          required
          defaultValue={prefilledVenue}
          placeholder="e.g. Funtime Soft Play"
          maxLength={200}
        />
      </Field>

      {/* Address */}
      <Field label="Venue address" hint="Helps us match your claim to the right listing">
        <Input name="venueAddress" placeholder="123 High Street, Hull, HU1 1AA" maxLength={300} />
      </Field>

      {/* Row 3: Phone + Website */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number">
          <Input name="venuePhone" type="tel" placeholder="01234 567890" maxLength={30} />
        </Field>
        <Field label="Website">
          <Input name="venueWebsite" type="url" placeholder="https://yourvenue.co.uk" maxLength={300} />
        </Field>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className={cn(
          'w-full rounded-xl py-4 text-base font-semibold text-white transition-all',
          'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          'shadow-md hover:shadow-lg'
        )}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Submitting…
          </span>
        ) : (
          'Claim My Free Listing →'
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        Free forever. No credit card. We review claims within 2 working days.
      </p>
    </form>
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
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {hint && <span className="ml-1 font-normal text-slate-400">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
