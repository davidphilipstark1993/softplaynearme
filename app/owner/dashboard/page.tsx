import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { OwnerDashboard } from '@/components/owner/OwnerDashboard'
import { getSessionClaim } from '@/lib/claims/session'
import { getOwnerData, isVerifiedClaim, photoLimitFor, FREE_PHOTO_LIMIT } from '@/lib/claims/db'
import { ownerCompleteness } from '@/lib/ownerData'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Your listing', robots: { index: false, follow: false } }

export default async function OwnerDashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const claim = await getSessionClaim()
  if (!claim) redirect('/owner/login')
  const { welcome } = await searchParams
  const data = (await getOwnerData(claim.venue_id)) ?? {}
  const photoLimit = claim.venue_id ? await photoLimitFor(claim.venue_id).catch(() => FREE_PHOTO_LIMIT) : FREE_PHOTO_LIMIT
  const venueUrl = claim.city_slug && claim.venue_slug ? `https://www.softplaynearme.co.uk/soft-play/${claim.city_slug}/${claim.venue_slug}` : null
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <OwnerDashboard
          venueName={claim.venue_name}
          venueUrl={venueUrl}
          verified={isVerifiedClaim(claim)}
          welcome={!!welcome}
          initialData={data}
          initialCompleteness={ownerCompleteness(data)}
          citySlug={claim.city_slug ?? ''}
          venueSlug={claim.venue_slug ?? ''}
          photoLimit={photoLimit}
        />
      </main>
      <Footer />
    </div>
  )
}
