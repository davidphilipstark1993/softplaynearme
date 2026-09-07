'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { CheckCircle2, Mail } from 'lucide-react'

interface EnquiryFormProps {
  venueId: number
  venueName: string
}

export function EnquiryForm({ venueId, venueName }: EnquiryFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get('name'),
      email: fd.get('email'),
      phone: fd.get('phone'),
      message: fd.get('message'),
    }

    try {
      const res = await fetch(`/api/venues/${venueId}/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setSent(true)
      ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
        'event',
        'enquiry_submitted',
        { venue_id: venueId }
      )
      ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
        'event',
        'lead_submitted',
        { venue_id: venueId }
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-purple-600" />
          Message {venueName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-900 mb-1">Message sent</p>
            <p className="text-sm text-slate-500">
              {venueName} will get back to you directly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input name="name" required placeholder="Your name" maxLength={120} />
            <Input name="email" type="email" required placeholder="Your email" maxLength={160} />
            <Input name="phone" type="tel" placeholder="Phone (optional)" maxLength={30} />
            <textarea
              name="message"
              required
              rows={4}
              maxLength={2000}
              placeholder={`Ask ${venueName} about availability, parties, or anything else…`}
              className={cn(
                'border-input placeholder:text-muted-foreground w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
              )}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
