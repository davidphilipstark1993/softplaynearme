'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ClaimVenueFormProps {
  prefilledVenue?: string
}

export function ClaimVenueForm({ prefilledVenue = '' }: ClaimVenueFormProps) {
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
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to submit claim')

      setSuccess('Claim submitted. We will review and reply by email.')
      setName('')
      setEmail('')
      if (!prefilledVenue) setVenueName('')
      setProof('')
      setMessage('')
    } catch (err: any) {
      setError(err?.message || 'Unable to submit claim')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-name">
            Your Name
          </label>
          <Input id="claim-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-email">
            Business Email
          </label>
          <Input
            id="claim-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={150}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-venue">
          Venue Name or URL
        </label>
        <Input
          id="claim-venue"
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          required
          maxLength={200}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-proof">
          Proof of Ownership (website, business reg, social link)
        </label>
        <Input id="claim-proof" value={proof} onChange={(e) => setProof(e.target.value)} required maxLength={255} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="claim-message">
          Message
        </label>
        <textarea
          id="claim-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-xs focus-visible:border-purple-500 focus-visible:ring-2 focus-visible:ring-purple-200 focus-visible:outline-none"
        />
      </div>

      {success && <p className="text-sm text-green-700">{success}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
        {loading ? 'Submitting...' : 'Submit Claim'}
      </Button>
    </form>
  )
}
