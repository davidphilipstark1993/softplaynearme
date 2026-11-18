import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ClaimForm } from '@/components/owner/ClaimForm'
import { getVenueForClaim } from '@/lib/claims/db'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Claim your listing', robots: { index: false, follow: false } }

export default async function ClaimPage({ params }: { params: Promise<{ city: string; slug: string }> }) {
  const { city, slug } = await params
  const venue = await getVenueForClaim(city, slug).catch(() => null)
  if (!venue) notFound()
  return (
    <div className="min-h-screen bg-slate-50">
      <Header backLink={{ href: `/soft-play/${city}/${slug}`, label: venue.name }} />
      <main className="max-w-lg mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Claim {venue.name}</h1>
        <p className="text-slate-600 mb-6">Free, and takes about two minutes. Once verified you can add your prices, sessions, party packages, photos and events, and your page shows a &quot;Verified by owner&quot; badge.</p>
        {venue.claimed_by_owner && (
          <p className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">This listing already has a verified owner. If that isn&apos;t you, claim it below and we&apos;ll check by hand.</p>
        )}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <ClaimForm citySlug={city} slug={slug} venueName={venue.name} />
        </div>
        <p className="text-sm text-slate-500 mt-6">Already claimed it? <Link href="/owner/login" className="underline">Get a new sign-in link</Link>.</p>
      </main>
      <Footer />
    </div>
  )
}
