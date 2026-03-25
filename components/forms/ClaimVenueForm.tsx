'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ClaimVenueFormProps {
  prefilledVenue?: string
  /** City slug, e.g. "hull" — passed when coming from a specific listing page */
  citySlug?: string
  /** Venue slug, e.g. "funtime-soft-play" */
  venueSlug?: string
  /** Full canonical URL of the venue listing */
  venueUrl?: string
}

export function ClaimVenueForm({
  prefilledVenue = '',
  citySlug = '',
  venueSlug = '',
  venueUrl = '',
}: ClaimVenueFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [venueName, setVenueName] = useState(prefilledVenue)
  const [proof, setProof] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    setError('')

    try {
      const response = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          venueName: venueName.trim(),
          proof: proof.trim(),
          message: message.trim(),
          citySlug: citySlug || undefined,
          venueSlug: venueSlug || undefined,
          venueUrl: venueUrl || undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to submit claim')

      setSuccess('Claim submitted. We will review and reply by email within 2 working days.')
      setName('')
      setEmail('')
      if (!prefilledVenue) setVenueName('')
      setProof('')
      setMessage('')
    } catch (err: any) {
      setError(err?.message || 'Unable to submit claim. Please try again or email info@softplaynearme.co.uk.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-name">
            Your Name <span className="text-red-500">*</span>
          </label>
          <Input
            id="claim-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            placeholder="e.g. Jane Smith"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-email">
            Business Email <span className="text-red-500">*</span>
          </label>
          <Input
            id="claim-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={150}
            placeholder="you@yourvenue.co.uk"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-venue">
          Venue Name <span className="text-red-500">*</span>
        </label>
        <Input
          id="claim-venue"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          required
          maxLength={200}
          placeholder="e.g. Funtime Soft Play Hull"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-proof">
          Proof of Ownership <span className="text-red-500">*</span>
          <span className="font-normal text-slate-500 ml-1">(website, Companies House URL, or social media page)</span>
        </label>
        <Input
          id="claim-proof"
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          required
          maxLength={500}
          placeholder="https://www.yourvenue.co.uk"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-message">
          What would you like to update? <span className="text-red-500">*</span>
        </label>
        <textarea
          id="claim-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus-visible:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-200 focus-visible:outline-none"
          placeholder="e.g. I'd like to update our opening hours, add photos, and correct our phone number."
        />
      </div>

      {success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm text-green-700 font-medium">{success}</p>
        </div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
        {loading ? 'Submitting…' : 'Submit Claim (Free)'}
      </Button>

      <p className="text-xs text-slate-400">
        We will never share your contact details. Claims are reviewed manually and confirmed by email.
      </p>
    </form>
  )
}
