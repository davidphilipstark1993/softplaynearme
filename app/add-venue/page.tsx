import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ClaimVenueForm } from '@/components/forms/ClaimVenueForm'
import { CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Claim Your Venue | Soft Play Near Me',
  description: 'Claim or add your soft play centre on Soft Play Near Me for free. Reach thousands of families and manage your listing from your own dashboard.',
  alternates: { canonical: 'https://www.softplaynearme.co.uk/add-venue' },
}

interface AddVenuePageProps {
  searchParams: Promise<{ venue?: string; city?: string; slug?: string }>
}

const BENEFITS = [
  'Free listing — no subscription, ever',
  'Appear in postcode searches by local families',
  'Showcase SEN sessions, parties, toddler areas and more',
  'Your own dashboard to update info and hours instantly',
  'Collect reviews and build your online reputation',
]

export default async function AddVenuePage({ searchParams }: AddVenuePageProps) {
  const { venue, city, slug } = await searchParams
  const venueUrl =
    city && slug
      ? `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`
      : undefined

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Claim Your Venue' }]} />

      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-purple-200 text-sm font-semibold uppercase tracking-wider mb-3">
            Free for venue owners
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Get Found by Thousands of Families
          </h1>
          <p className="text-purple-100 text-lg max-w-lg mx-auto">
            Claim your free listing and manage your venue&apos;s info, hours, and photos from one simple dashboard.
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-14">

        {/* Form card — the main CTA */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-9 mb-8">
          {venue ? (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Claim your listing</h2>
              <p className="text-slate-500 text-sm mb-6">
                Claiming: <strong className="text-slate-700">{venue}</strong>
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900 mb-1">Claim or list your venue</h2>
              <p className="text-slate-500 text-sm mb-6">
                Takes about 60 seconds. We&apos;ll review and confirm within 2 working days.
              </p>
            </>
          )}

          <ClaimVenueForm
            prefilledVenue={venue || ''}
            citySlug={city || ''}
            venueSlug={slug || ''}
            venueUrl={venueUrl || ''}
          />
        </div>

        {/* Benefits — beneath the form, not above */}
        <div className="bg-purple-50 rounded-2xl border border-purple-100 p-6">
          <h3 className="font-semibold text-purple-900 mb-4">What you get — completely free</h3>
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
