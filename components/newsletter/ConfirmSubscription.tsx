'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type State = 'idle' | 'loading' | 'done' | 'expired' | 'invalid' | 'error'

export function ConfirmSubscription({ token }: { token: string }) {
  const [state, setState] = useState<State>(token ? 'idle' : 'invalid')
  const [unsubscribeToken, setUnsubscribeToken] = useState('')

  async function confirm() {
    setState('loading')
    try {
      const res = await fetch('/api/newsletter/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setUnsubscribeToken(data.unsubscribeToken ?? '')
        setState('done')
      } else if (data.error === 'expired') setState('expired')
      else if (res.status === 404 || res.status === 400) setState('invalid')
      else setState('error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <>
        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-600" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">You&rsquo;re confirmed!</h1>
        <p className="text-slate-500 mb-6">Thanks &mdash; you&rsquo;re subscribed. Every email has an unsubscribe link, so you&rsquo;re always in control.</p>
        {unsubscribeToken && (
          <Link href={`/newsletter/preferences?token=${unsubscribeToken}`} className="text-sm text-purple-600 underline hover:text-purple-700">
            Manage your preferences
          </Link>
        )}
      </>
    )
  }

  if (state === 'idle' || state === 'loading' || state === 'error') {
    return (
      <>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Confirm your subscription</h1>
        <p className="text-slate-500 mb-6">One click and you&rsquo;re on the list. Nothing is sent until you confirm.</p>
        <Button onClick={confirm} disabled={state === 'loading'} className="bg-purple-600 hover:bg-purple-700">
          {state === 'loading' ? 'Confirming…' : 'Confirm my subscription'}
        </Button>
        {state === 'error' && (
          <p role="alert" className="mt-4 text-sm text-red-600">Something went wrong &mdash; please try again.</p>
        )}
      </>
    )
  }

  return (
    <>
      <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {state === 'expired' ? 'This link has expired' : 'Link not recognised'}
      </h1>
      <p className="text-slate-500 mb-6">
        {state === 'expired'
          ? 'Confirmation links last 7 days. Please sign up again to get a fresh one.'
          : 'This confirmation link is invalid, or a newer one has replaced it. Please sign up again.'}
      </p>
      <Link href="/newsletter" className="text-sm text-purple-600 underline hover:text-purple-700">
        Back to the newsletter page
      </Link>
    </>
  )
}
