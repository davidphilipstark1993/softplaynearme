'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'

const TOPICS = ['General enquiry', 'Add or claim a venue', 'Report an error', 'Other']

interface ContactFormProps {
  defaultTopic?: string
}

export function ContactForm({ defaultTopic = 'General enquiry' }: ContactFormProps) {
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
      topic: fd.get('topic'),
      message: fd.get('message'),
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setSent(true)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again or email info@softplaynearme.co.uk'
      )
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="font-semibold text-lg text-slate-900 mb-1">Message sent</h3>
        <p className="text-sm text-slate-600">
          Thanks for getting in touch — we aim to respond within 48 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required>
          <Input name="name" required placeholder="Jane Smith" maxLength={100} />
        </Field>
        <Field label="Your email" required>
          <Input name="email" type="email" required placeholder="you@example.co.uk" maxLength={150} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" hint="optional">
          <Input name="phone" type="tel" placeholder="01234 567890" maxLength={30} />
        </Field>
        <Field label="What's this about?" required>
          <select
            name="topic"
            required
            defaultValue={defaultTopic}
            className={cn(
              'border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
            )}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Message" required>
        <textarea
          name="message"
          required
          rows={5}
          maxLength={5000}
          placeholder="Tell us what's on your mind…"
          className={cn(
            'border-input placeholder:text-muted-foreground w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
          )}
        />
      </Field>

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
            Sending…
          </span>
        ) : (
          'Send Message'
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        We aim to respond to all messages within 48 hours.
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
