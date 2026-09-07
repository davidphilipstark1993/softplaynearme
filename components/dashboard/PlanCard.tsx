'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Sparkles, CheckCircle2 } from 'lucide-react'
import { PLAN_LABELS, type Plan, type PlanStatus } from '@/lib/plans'

interface PlanCardProps {
  token: string
  venueId?: number
  plan: Plan
  planStatus: PlanStatus
  stripeCustomerId?: string | null
}

const PLAN_STYLES: Record<Plan, string> = {
  free: 'bg-slate-100 text-slate-700',
  premium: 'bg-purple-100 text-purple-700',
  bespoke: 'bg-amber-100 text-amber-800',
}

function gtag(...args: unknown[]) {
  ;(window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.(...args)
}

export function PlanCard({ token, venueId, plan, planStatus, stripeCustomerId }: PlanCardProps) {
  const [interval, setIntervalValue] = useState<'month' | 'year'>('month')
  const [checkingOut, setCheckingOut] = useState(false)
  const [requestingBespoke, setRequestingBespoke] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)
  const isActive = (plan === 'premium' || plan === 'bespoke') && (planStatus === 'active' || planStatus === 'trialing')

  async function startPremiumCheckout() {
    setCheckingOut(true)
    gtag('event', 'upgrade_started', { venue_id: venueId, plan: 'premium', interval })
    try {
      const res = await fetch(`/api/dashboard/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Could not start checkout — please try again')
        setCheckingOut(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Could not start checkout — please try again')
      setCheckingOut(false)
    }
  }

  async function requestBespoke() {
    setRequestingBespoke(true)
    gtag('event', 'upgrade_started', { venue_id: venueId, plan: 'bespoke' })
    try {
      const res = await fetch(`/api/dashboard/${token}/upgrade-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'bespoke' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not send your request — please try again')
        return
      }
      toast.success("Request sent — we'll be in touch shortly to get you set up")
    } catch {
      toast.error('Could not send your request — please try again')
    } finally {
      setRequestingBespoke(false)
    }
  }

  async function openBillingPortal() {
    setOpeningPortal(true)
    try {
      const res = await fetch(`/api/dashboard/${token}/portal`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Could not open billing management — please try again')
        setOpeningPortal(false)
        return
      }
      window.location.href = data.url
    } catch {
      toast.error('Could not open billing management — please try again')
      setOpeningPortal(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-slate-900">Your plan</h2>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_STYLES[plan]}`}>
          {isActive && <CheckCircle2 className="w-3 h-3" />}
          {PLAN_LABELS[plan]}
        </span>
      </div>

      {plan === 'free' ? (
        <>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            You&apos;re on the Free plan — free forever. Upgrade for a Verified badge,
            featured placement, and lead notifications straight to your inbox.
          </p>

          <div className="inline-flex items-center rounded-lg border border-slate-200 p-0.5 mb-3 text-sm">
            <button
              type="button"
              onClick={() => setIntervalValue('month')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${interval === 'month' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
            >
              Monthly — £24.99/mo
            </button>
            <button
              type="button"
              onClick={() => setIntervalValue('year')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${interval === 'year' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
            >
              Annual — £249/yr
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={startPremiumCheckout}
              disabled={checkingOut || requestingBespoke}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {checkingOut ? 'Redirecting…' : 'Upgrade to Premium'}
            </button>
            <button
              onClick={requestBespoke}
              disabled={checkingOut || requestingBespoke}
              className="text-sm text-slate-600 hover:text-purple-700 hover:underline disabled:opacity-60"
            >
              {requestingBespoke ? 'Sending…' : 'Request a Bespoke quote'}
            </button>
            <Link href="/pricing" className="text-sm text-purple-600 hover:underline">
              Compare plans
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500 mt-1 mb-3">
            {isActive
              ? `You're on ${PLAN_LABELS[plan]} — thanks for supporting the directory. Questions about your plan? Reply to any of our emails.`
              : `Your ${PLAN_LABELS[plan]} plan is ${planStatus}. Contact us if this doesn't look right.`}
          </p>
          {isActive && plan === 'premium' && stripeCustomerId && (
            <button
              onClick={openBillingPortal}
              disabled={openingPortal}
              className="text-sm text-purple-600 hover:underline disabled:opacity-60"
            >
              {openingPortal ? 'Opening…' : 'Manage billing / cancel'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
