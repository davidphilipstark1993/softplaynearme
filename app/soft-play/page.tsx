import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { cities } from '@/lib/venues'
import { getVenueCounts, formatVenueTotal } from '@/lib/venueCounts'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const counts = await getVenueCounts()
  return {
    title: { absolute: `Soft Play by Town & City: ${formatVenueTotal(counts.total)} UK Centres` },
    description: `Browse ${formatVenueTotal(counts.total)} UK soft play centres by town and city. Compare ratings, facilities and contact details, then find the right centre near you.`,
    alternates: { canonical: 'https://www.softplaynearme.co.uk/soft-play' },
  }
}

/** Index of every hub with venues, grouped by county. The "Soft Play" level of venue breadcrumbs. */
export default async function SoftPlayIndex() {
  const counts = await getVenueCounts()
  const hubs = cities.map((c) => ({ ...c, venues: counts.byCity[c.slug] ?? 0 })).filter((c) => c.venues > 0)
  const byCounty = new Map<string, typeof hubs>()
  for (const h of hubs) byCounty.set(h.county || 'Other', [...(byCounty.get(h.county || 'Other') ?? []), h])
  const groups = [...byCounty.entries()].sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Soft Play' }]} />
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Soft Play Near Me</h1>
        <p className="text-slate-600 mb-8">Find soft play centres by town or city.</p>
        {groups.map(([county, list]) => (
          <section key={county} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{county}</h2>
            <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {list.sort((a, b) => a.name.localeCompare(b.name)).map((h) => (
                <li key={h.slug}>
                  <Link href={`/soft-play/${h.slug}`} className="text-purple-700 hover:underline">
                    Soft play in {h.name}
                  </Link>{' '}
                  <span className="text-slate-500 text-sm">({h.venues})</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  )
}
