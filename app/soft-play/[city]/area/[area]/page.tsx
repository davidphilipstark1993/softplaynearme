import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import { VenueCard } from '@/components/venue/VenueCard'
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema } from '@/lib/schema'
import { LONDON_AREAS } from '@/lib/londonAreas'
import { getLondonAreaGroups, getLondonAreaHubs, buildAreaContent, londonAreaPath, MIN_AREA_VENUES } from '@/lib/londonAreaHubs'

/**
 * London area sub-hub, e.g. /soft-play/london/area/east-london. Only London, and only areas
 * with MIN_AREA_VENUES or more venues (lib/londonAreaHubs.ts); anything else is a 404.
 */
export const revalidate = 3600

interface PageProps {
  params: Promise<{ city: string; area: string }>
}

const BASE = 'https://www.softplaynearme.co.uk'

async function load(city: string, area: string) {
  if (city !== 'london') return null
  const meta = LONDON_AREAS.find((a) => a.slug === area)
  if (!meta) return null
  const venues = (await getLondonAreaGroups()).get(area) ?? []
  if (venues.length < MIN_AREA_VENUES) return null
  venues.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0) || (b.review_count ?? 0) - (a.review_count ?? 0) || a.name.localeCompare(b.name))
  return { meta, venues }
}

export async function generateStaticParams() {
  return (await getLondonAreaHubs()).map((a) => ({ city: 'london', area: a.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, area } = await params
  const data = await load(city, area)
  if (!data) return { title: 'Area Not Found', robots: { index: false, follow: false } }
  const { meta, venues } = data
  const title = `Soft Play in ${meta.name}: ${venues.length} Indoor Play Centres (${new Date().getFullYear()})`
  const { summary } = buildAreaContent(meta.name, venues)
  const url = `${BASE}${londonAreaPath(area)}`
  return {
    title: { absolute: title },
    description: summary.length > 155 ? `${summary.slice(0, 152).replace(/\s+\S*$/, '')}…` : summary,
    alternates: { canonical: url },
    openGraph: { title, description: summary, url, type: 'website', siteName: 'Soft Play Near Me' },
  }
}

export default async function LondonAreaPage({ params }: PageProps) {
  const { city, area } = await params
  const data = await load(city, area)
  if (!data) notFound()
  const { meta, venues } = data
  const { summary, faqs } = buildAreaContent(meta.name, venues)
  const others = (await getLondonAreaHubs()).filter((a) => a.slug !== area)
  const url = `${BASE}${londonAreaPath(area)}`

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: 'Home', url: BASE },
          { name: 'Soft Play', url: `${BASE}/soft-play` },
          { name: 'Soft Play in London', url: `${BASE}/soft-play/london` },
          { name: meta.name, url },
        ])}
      />
      <JsonLd data={buildItemListSchema(venues.map((v) => ({ name: v.name, slug: v.slug, citySlug: 'london', address: v.address, postcode: v.postcode, avgRating: v.avg_rating ?? undefined, reviewCount: v.review_count })), `Soft Play Centres in ${meta.name}`)} />
      <JsonLd data={buildFAQSchema(faqs)} />
      <div className="min-h-screen bg-slate-50">
        <Header />
        <Breadcrumbs items={[{ label: 'Soft Play', href: '/soft-play' }, { label: 'London', href: '/soft-play/london' }, { label: meta.name }]} />
        <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Soft Play in {meta.name}</h1>
            <p className="text-purple-100 text-lg max-w-3xl">{summary}</p>
          </div>
        </div>
        <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
          <h2 className="text-xl font-semibold mb-4">All soft play in {meta.name} ({venues.length})</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {venues.map((v) => (
              <VenueCard key={v.slug} venue={{ ...v, citySlug: 'london', price_from: v.price_from, price_to: v.price_to }} />
            ))}
          </div>

          <section aria-labelledby="area-faq-heading" className="mt-12">
            <h2 id="area-faq-heading" className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
            <dl className="space-y-4">
              {faqs.map((f) => (
                <div key={f.question} className="bg-white p-6 rounded-lg border border-slate-200">
                  <dt className="font-semibold text-lg mb-2">{f.question}</dt>
                  <dd className="text-slate-600">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="other-areas-heading" className="mt-12">
            <h2 id="other-areas-heading" className="text-xl font-semibold mb-3">Other areas of London</h2>
            <ul className="flex flex-wrap gap-3 text-sm">
              {others.map((a) => (
                <li key={a.slug}>
                  <Link href={londonAreaPath(a.slug)} className="text-purple-700 underline hover:text-purple-900">
                    Soft play in {a.name} ({a.count})
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/soft-play/london" className="text-purple-700 underline hover:text-purple-900">All soft play in London</Link>
              </li>
            </ul>
          </section>
        </main>
        <Footer />
      </div>
    </>
  )
}
