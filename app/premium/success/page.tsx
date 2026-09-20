import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PurchaseTracking } from '@/components/premium/PurchaseTracking'
import { CheckCircle2, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Direct Debit Set Up',
  robots: { index: false, follow: false },
}

interface PremiumSuccessPageProps {
  searchParams: Promise<{ token?: string; session_id?: string; interval?: string }>
}

export default async function PremiumSuccessPage({ searchParams }: PremiumSuccessPageProps) {
  const { token, session_id, interval } = await searchParams
  const dashboardUrl = token ? `/dashboard/${token}` : '/dashboard'
  const billingInterval = interval === 'year' ? 'year' : 'month'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <PurchaseTracking
        sessionId={session_id}
        value={billingInterval === 'year' ? 249 : 24.99}
        interval={billingInterval}
      />

      <main id="main-content" className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 border-4 border-purple-200 mb-5">
          <CheckCircle2 className="w-8 h-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Direct Debit set up 🎉</h1>
        <p className="text-slate-600 text-lg mb-6">
          Thanks — Stripe has your Direct Debit mandate. We&apos;re finalising your Premium subscription now;
          this usually takes a minute or two.
        </p>
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5 mb-10">
          <Mail className="w-3.5 h-3.5" />
          We&apos;ll email you the moment Premium is active on your listing.
        </p>

        <Link
          href={dashboardUrl}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold px-8 py-4 rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all shadow-md hover:shadow-lg text-base"
        >
          Open My Dashboard
        </Link>
      </main>
      <Footer />
    </div>
  )
}
