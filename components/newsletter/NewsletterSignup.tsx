'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Variant = 'card' | 'inline' | 'compact'

export interface NewsletterSignupProps {
  /** Where on the site this instance lives — stored on the subscriber row for admin reporting. */
  source: string
  heading?: string
  subtext?: string
  /** 'weekly' pre-selects only the weekly newsletter, 'events' only events, 'both' offers both as checkboxes. */
  offer?: 'weekly' | 'events' | 'both'
  variant?: Variant
  className?: string
}

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error'

export function NewsletterSignup({
  source,
  heading = 'Get Sunday&rsquo;s family guide',
  subtext = 'Soft play picks, family days out and offers near you — straight to your inbox, no spam.',
  offer = 'weekly',
  variant = 'card',
  className,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot — real visitors never fill this in
  const [weekly, setWeekly] = useState(offer !== 'events')
  const [events, setEvents] = useState(offer === 'events')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          weeklyNewsletter: offer === 'both' ? weekly : offer !== 'events',
          eventsActivities: offer === 'both' ? events : offer === 'events',
          source,
          company,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setStatus(data.outcome === 'already_subscribed' ? 'already' : 'success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again')
    }
  }

  if (status === 'success' || status === 'already') {
    return (
      <div className={cn('rounded-xl border border-purple-200 bg-purple-50 px-5 py-4 text-center', className)}>
        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-purple-600" />
        <p className="text-sm font-semibold text-slate-900">
          {status === 'already' ? "You're already subscribed" : "You're on the list!"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {status === 'already'
            ? 'That email is already signed up — no action needed.'
            : "Keep an eye on your inbox — we'll send our next update soon."}
        </p>
      </div>
    )
  }

  const isCompact = variant === 'compact'

  return (
    <div
      className={cn(
        variant === 'card' && 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm',
        variant === 'inline' && 'rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 p-5',
        className
      )}
    >
      {!isCompact && (
        <div className={cn('mb-4', variant === 'inline' ? 'text-left' : 'text-center')}>
          <div className={cn('flex items-center gap-2', variant === 'inline' ? '' : 'justify-center')}>
            <Mail className="h-4 w-4 text-purple-600" />
            <h3 className="font-semibold text-slate-900" dangerouslySetInnerHTML={{ __html: heading }} />
          </div>
          <p className="mt-1.5 text-sm text-slate-500">{subtext}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className={cn('flex gap-2', isCompact ? 'flex-row' : 'flex-col sm:flex-row')}>
        <input
          type="text"
          name="company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.co.uk"
          maxLength={254}
          aria-label="Email address"
          className="flex-1 bg-white"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className={cn(
            'whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold text-white transition-all',
            'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600',
            'disabled:cursor-not-allowed disabled:opacity-60'
          )}
        >
          {status === 'loading' ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" /> Subscribing&hellip;
            </span>
          ) : (
            'Subscribe'
          )}
        </button>
      </form>

      {offer === 'both' && (
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-slate-600 sm:flex-row sm:gap-4">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={weekly} onChange={(e) => setWeekly(e.target.checked)} className="rounded" />
            Weekly Soft Play Near Me newsletter
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={events} onChange={(e) => setEvents(e.target.checked)} className="rounded" />
            Family events & activities
          </label>
        </div>
      )}

      {status === 'error' && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <p className="mt-2.5 text-[11px] text-slate-400">
        No spam, unsubscribe any time. See our{' '}
        <a href="/privacy" className="underline hover:text-slate-500">
          privacy policy
        </a>
        .
      </p>
    </div>
  )
}
