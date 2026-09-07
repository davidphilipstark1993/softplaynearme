import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { computeCompleteness, scoreColor, scoreLabel } from '@/lib/completeness'
import { formatAddressLine } from '@/lib/sanitize'
import { ResendVerificationButton } from '@/components/dashboard/ResendVerificationButton'
import { PlanCard } from '@/components/dashboard/PlanCard'
import { LeadInbox } from '@/components/dashboard/LeadInbox'
import { isPaidActive } from '@/lib/plans'
import {
  CheckCircle2, Clock, AlertCircle, ExternalLink,
  Pencil, Camera, ListChecks, PoundSterling, FileText, ArrowRight, Mail, Eye,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Venue Dashboard | Soft Play Near Me',
  robots: { index: false, follow: false },
}

interface DashboardPageProps {
  params: Promise<{ token: string }>
  searchParams: Promise<{ verified?: string }>
}

export const revalidate = 0 // always fresh

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { token } = await params
  const { verified } = await searchParams

  // Fetch claim + venue via our own API
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.softplaynearme.co.uk'}/api/dashboard/${token}`,
    { cache: 'no-store' }
  )

  if (!res.ok) notFound()

  const { claim, venue, enquiries = [] } = await res.json()
  const { score, missing } = computeCompleteness(venue)
  const color = scoreColor(score)
  const label = scoreLabel(score)

  const isPending = claim.status === 'pending'
  const venueUrl =
    claim.city_slug && claim.venue_slug
      ? `https://www.softplaynearme.co.uk/soft-play/${claim.city_slug}/${claim.venue_slug}`
      : null

  const quickActions = [
    { icon: Pencil, label: 'Edit Basic Info', anchor: '#basic', desc: 'Name, address, phone, website' },
    { icon: FileText, label: 'Add Description', anchor: '#description', desc: 'Tell parents what you offer' },
    { icon: Clock, label: 'Opening Hours', anchor: '#hours', desc: 'Set times for every day' },
    { icon: ListChecks, label: 'Facilities', anchor: '#facilities', desc: 'Café, parking, SEN, parties…' },
    { icon: PoundSterling, label: 'Pricing', anchor: '#pricing', desc: 'Session prices and packages' },
    { icon: Camera, label: 'Photos', anchor: '#photos', desc: 'Add your main venue image' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-medium text-purple-600 mb-1">Venue Dashboard</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {venue?.name || claim.venue_name}
            </h1>
            {formatAddressLine(venue?.address, venue?.postcode) && (
              <p className="text-slate-500 text-sm mt-1">{formatAddressLine(venue?.address, venue?.postcode)}</p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {venueUrl && (
              <a
                href={venueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors"
              >
                <Eye className="w-3.5 h-3.5" /> Preview Public Page
              </a>
            )}
            <Link
              href={`/dashboard/${token}/edit`}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit listing
            </Link>
          </div>
        </div>

        {/* Email just verified — show once */}
        {verified === '1' && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="font-medium text-green-900 text-sm">
              Email verified! Your ownership is confirmed.
            </p>
          </div>
        )}

        {/* Email verification banner */}
        {!verified && claim.email_verified === false && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <Mail className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-blue-900 text-sm">Please verify your email address</p>
              <p className="text-blue-700 text-sm mt-0.5">
                We sent a verification link to your inbox. Click it to confirm ownership and unlock full dashboard access.
              </p>
            </div>
            <ResendVerificationButton token={token} />
          </div>
        )}

        {/* Claim status banner */}
        {isPending && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 text-sm">Claim under review</p>
              <p className="text-amber-700 text-sm mt-0.5">
                We&apos;ll verify your ownership and confirm within 2 working days. You can start updating your listing now — changes apply immediately once approved.
              </p>
            </div>
          </div>
        )}

        {claim.status === 'approved' && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="font-medium text-green-900 text-sm">
              Claim approved — you have full control of this listing.
            </p>
          </div>
        )}

        {/* Plan card — only once the venue exists to have a plan on it */}
        {venue && (
          <PlanCard
            token={token}
            venueId={venue.id}
            plan={venue.plan || 'free'}
            planStatus={venue.plan_status || 'inactive'}
            stripeCustomerId={venue.stripe_customer_id || null}
          />
        )}

        {venue && <LeadInbox enquiries={enquiries} isPaidActive={isPaidActive(venue)} />}

        {/* Completeness card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Listing completeness</h2>
              <p className="text-sm text-slate-500 mt-0.5">{label}</p>
            </div>
            <span className="text-3xl font-bold" style={{ color }}>{score}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${score}%`, backgroundColor: color }}
            />
          </div>

          {/* Missing items */}
          {missing.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Improve your listing
              </p>
              <div className="space-y-2">
                {missing.slice(0, 4).map((item) => (
                  <Link
                    key={item.key}
                    href={`/dashboard/${token}/edit#${item.anchor}`}
                    className="flex items-center gap-3 group"
                  >
                    <span className="text-lg flex-shrink-0 w-7 text-center">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 group-hover:text-purple-700 transition-colors truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        +{item.weight}%
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-400 transition-colors" />
                    </div>
                  </Link>
                ))}
                {missing.length > 4 && (
                  <Link
                    href={`/dashboard/${token}/edit`}
                    className="text-sm text-purple-600 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    +{missing.length - 4} more to complete <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          )}

          {missing.length === 0 && (
            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Your listing is complete — great work!
            </p>
          )}
        </div>

        {/* Quick actions grid */}
        <h2 className="font-semibold text-slate-900 mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.label}
                href={`/dashboard/${token}/edit${action.anchor}`}
                className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                  <Icon className="w-4 h-4 text-purple-600" />
                </div>
                <p className="font-semibold text-slate-800 text-sm group-hover:text-purple-700 transition-colors">
                  {action.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
              </Link>
            )
          })}
        </div>

        {/* Venue snapshot (if linked) */}
        {venue && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Current listing snapshot</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Phone', value: venue.phone },
                { label: 'Website', value: venue.website },
                { label: 'Price from', value: venue.price_from ? `£${venue.price_from}` : null },
                { label: 'Price range', value: venue.price_range },
                { label: 'Avg rating', value: venue.avg_rating && Number(venue.avg_rating) > 0 ? `${Number(venue.avg_rating).toFixed(1)} ★` : null },
                { label: 'Reviews', value: venue.review_count && Number(venue.review_count) > 0 ? `${venue.review_count} reviews` : null },
              ]
                .filter((f) => f.value)
                .map((field) => (
                  <div key={field.label}>
                    <dt className="text-slate-400 text-xs font-medium uppercase tracking-wider">{field.label}</dt>
                    <dd className="text-slate-800 mt-0.5 font-medium">{field.value}</dd>
                  </div>
                ))}
            </dl>

            {/* Facility badges */}
            {(venue.cafe || venue.parking || venue.parties || venue.toddler_area || venue.sen_friendly || venue.wheelchair_access) && (
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2.5">Facilities</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'cafe', label: 'Café' },
                    { key: 'parking', label: 'Free Parking' },
                    { key: 'parties', label: 'Birthday Parties' },
                    { key: 'toddler_area', label: 'Toddler Area' },
                    { key: 'sen_friendly', label: 'SEN Friendly' },
                    { key: 'wheelchair_access', label: 'Wheelchair Access' },
                    { key: 'has_outdoor_play', label: 'Outdoor Play' },
                    { key: 'free_wifi', label: 'Free WiFi' },
                  ]
                    .filter((f) => venue[f.key])
                    .map((f) => (
                      <span key={f.key} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        {f.label}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No venue linked yet */}
        {!venue && (
          <div className="bg-slate-100 rounded-2xl border border-slate-200 p-8 text-center">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700 mb-2">Setting up your listing</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Once your claim is approved, your venue will appear here and you&apos;ll be able to manage all details from this dashboard.
            </p>
          </div>
        )}

      </main>
      <Footer />
    </div>
  )
}
