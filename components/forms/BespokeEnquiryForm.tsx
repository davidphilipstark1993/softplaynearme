'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function BespokeEnquiryForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const venueCount = fd.get('venueCount')
    const budget = fd.get('budget')
    const goals = fd.get('goals')

    const message = [
      venueCount ? `Number of venues: ${venueCount}` : null,
      budget ? `Monthly marketing budget: ${budget}` : null,
      goals ? `What they want from Soft Play Near Me: ${goals}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const body = {
      name: fd.get('name'),
      email: fd.get('email'),
      venueName: fd.get('venueName'),
      venueAddress: fd.get('venueAddress'),
      venuePhone: fd.get('venuePhone'),
      venueWebsite: fd.get('venueWebsite'),
      planInterest: 'bespoke',
      message,
    }

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      router.push('/pricing/bespoke/success')
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again or email david@softplaynearme.co.uk'
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
      <Field label="Venue / business name" required>
        <Input name="venueName" required placeholder="e.g. Funtime Soft Play" maxLength={200} />
      </Field>

      {/* Address */}
      <Field label="Venue address" hint="Or head office if you run more than one">
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

      <div className="border-t border-slate-100 pt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How many venues do you run?">
            <Input name="venueCount" placeholder="e.g. 1, or 5 across the North West" maxLength={100} />
          </Field>
          <Field label="Monthly marketing budget">
            <Input name="budget" placeholder="e.g. £100-£300/mo" maxLength={100} />
          </Field>
        </div>

        <Field label="What are you hoping to get from Soft Play Near Me?" hint="Leads, brand visibility, multi-venue management — whatever matters to you">
          <textarea
            name="goals"
            rows={4}
            maxLength={1000}
            placeholder="Tell us a bit about what you're looking for so we can put together the right quote"
            className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          />
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
          'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600',
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
          'Get My Bespoke Quote →'
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        No commitment. We&apos;ll reply with a tailored quote within 1 working day.
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
