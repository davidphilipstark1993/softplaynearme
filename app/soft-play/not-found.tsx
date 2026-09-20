import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { cities } from '@/lib/venues'
import { MapPin } from 'lucide-react'

// See app/not-found.tsx — same reasoning: without this, the root layout's
// homepage title + canonical would otherwise leak onto this 404 response.
export const metadata: Metadata = {
  title: 'Venue or Location Not Found',
  description: 'The soft play listing or location you were looking for could not be found.',
  alternates: { canonical: undefined },
  robots: { index: false, follow: false },
}

export default function SoftPlayNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-lg">
          <h1 className="text-6xl font-bold text-purple-600 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Venue or Location Not Found</h2>
          <p className="text-slate-600 mb-8">
            We couldn&apos;t find that soft play listing. It may have been removed or the URL might be incorrect. Try searching or browse one of our popular locations below.
          </p>
          <div className="flex gap-4 justify-center mb-10">
            <Link href="/">
              <Button className="bg-purple-600 hover:bg-purple-700">Go Home</Button>
            </Link>
            <Link href="/search">
              <Button variant="outline">Search Venues</Button>
            </Link>
          </div>

          <h3 className="text-lg font-semibold text-slate-900 mb-4">Browse by Location</h3>
          <div className="flex flex-wrap gap-2 justify-center">
            {cities.map((city) => (
              <Link
                key={city.slug}
                href={`/soft-play/${city.slug}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-purple-300 hover:text-purple-600 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                {city.name}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
