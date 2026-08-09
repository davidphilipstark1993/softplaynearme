import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { PremiumSignupForm } from '@/components/forms/PremiumSignupForm'
import { CheckCircle2, Sparkles } from 'lucide-react'

const TITLE = 'Go Premium'
const SOCIAL_TITLE = 'Go Premium | Soft Play Near Me'
const DESCRIPTION =
  'Upgrade to Premium on Soft Play Near Me — Verified badge, featured placement, and lead notifications for £24.99/month by Direct Debit.'
const URL = 'https://www.softplaynearme.co.uk/premium'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  alternates: { canonical: URL },
  openGraph: {
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    siteName: 'Soft Play Near Me',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
}

interface PremiumPageProps {
  searchParams: Promise<{ venue?: string; city?: string; slug?: string; cancelled?: string }>
}

const BENEFITS = [
  'Verified badge on your listing',
  'Featured placement in your city',
  'Lead notifications by email',
  'Extra photos',
  'Priority in relevant filters',
]

export default async function PremiumPage({ searchParams }: PremiumPageProps) {
  const { venue, city, slug, cancelled } = await searchParams
  const venueUrl =
    city && slug
      ? `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`
      : undefined

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Pricing', href: '/pricing' }, { label: 'Premium' }]} />

      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-purple-200 text-sm font-semibold uppercase tracking-wider mb-3 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Premium
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Get Verified &amp; Get Leads
          </h1>
          <p className="text-purple-100 text-lg max-w-lg mx-auto">
            £24.99/month by Direct Debit — a rolling month-to-month contract, cancel any time.
            Set-up takes about 2 minutes.
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        {cancelled && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            Direct Debit set-up was cancelled — no subscription was created. You can try again below.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-9 mb-8">
          {venue ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Upgrade your listing</h2>
              <p className="text-slate-500 text-sm mb-6">
                Upgrading: <strong className="text-slate-700">{venue}</strong>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Claim &amp; go Premium</h2>
              <p className="text-slate-500 text-sm mb-6">
                Same details as a free listing, plus setting up your Direct Debit.
              </p>
            </>
          )}

          <PremiumSignupForm
            prefilledVenue={venue || ''}
            citySlug={city || ''}
            venueSlug={slug || ''}
            venueUrl={venueUrl || ''}
          />
        </div>

        <div className="bg-purple-50 rounded-2xl border border-purple-100 p-6">
          <h3 className="font-semibold text-purple-900 mb-4">What Premium includes</h3>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <span className="text-purple-800 text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  )
}
