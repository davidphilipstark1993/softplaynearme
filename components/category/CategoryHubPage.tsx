import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import { TrackPageEvent } from '@/components/analytics/TrackPageEvent'
import { buildBreadcrumbSchema, buildFAQSchema } from '@/lib/schema'
import { getPool, STATIC_BUILD } from '@/lib/pool'
import { getCityBySlug } from '@/lib/venues'
import { getStaticTowns, getStaticVenuesByTown } from '@/lib/staticVenues'
import { isVisibleVenueType, visibleVenueTypeSql } from '@/lib/venueTypes'
import { isVenueIndexable } from '@/lib/venueContent'
import { minFilterVenues } from '@/lib/hubGuides'
import { trimMeta } from '@/lib/metaLength'
import { HUBS, HUB_SLUGS, groupHubVenues, hubFaqs, hubPath, type HubSlug, type HubVenue } from '@/lib/categoryHubs'

const SITE = 'https://www.softplaynearme.co.uk'

/** Indexable, visible soft play venues that match the hub, from the DB or the static export. */
async function getHubVenues(slug: HubSlug): Promise<HubVenue[]> {
  const hub = HUBS[slug]
  if (!STATIC_BUILD) {
    try {
      const { rows } = await getPool().query(
        `SELECT name, slug, city_slug, city, town, rating, reviews_count, venue_type, completeness_score,
                toddler_area, baby_area, under_1s, has_under_1s, sen_friendly, has_sen_sessions, parties, cafe,
                age_range_min, age_range_max, price_from, prebooking_required
           FROM venues v
          WHERE v.is_active = true AND ${visibleVenueTypeSql('v')}`,
      )
      return rows.filter((v) => isVenueIndexable(Number(v.completeness_score ?? 0), v.venue_type) && hub.matches(v))
    } catch (error) {
      console.error(`[CategoryHub] DB error for ${slug}:`, error)
    }
  }
  // Static export: listable venues only, with the facility flags it carries.
  return getStaticTowns()
    .flatMap((t) => getStaticVenuesByTown(t.slug))
    .filter((v) => isVisibleVenueType(v.venueType))
    .map((v): HubVenue => ({
      name: v.name, slug: v.slug, city_slug: v.townSlug, town: v.town, rating: v.rating ?? null,
      reviews_count: v.reviewCount ?? null, toddler_area: v.toddlerArea, baby_area: v.babyArea,
      sen_friendly: v.senFriendly, parties: v.parties, cafe: v.cafe, price_from: v.priceFrom ?? null,
    }))
    .filter(hub.matches)
}

function cityInfo(slug: string) {
  const c = getCityBySlug(slug)
  return c ? { name: c.name, region: c.region } : undefined
}

export async function buildHubMetadata(slug: HubSlug): Promise<Metadata> {
  const hub = HUBS[slug]
  const venues = await getHubVenues(slug)
  const places = new Set(venues.map((v) => v.city_slug)).size
  const url = `${SITE}${hubPath(slug)}`
  return {
    title: { absolute: hub.title(venues.length) },
    description: trimMeta(hub.description(venues.length, places)),
    alternates: { canonical: url },
    openGraph: { title: hub.title(venues.length), description: trimMeta(hub.description(venues.length, places)), url, type: 'website' },
  }
}

export async function CategoryHubPage({ slug }: { slug: HubSlug }) {
  const hub = HUBS[slug]
  const venues = await getHubVenues(slug)
  const regions = groupHubVenues(venues, cityInfo)
  const places = regions.reduce((n, r) => n + r.cities.length, 0)
  const faqs = hubFaqs(hub, venues, places)
  const others = HUB_SLUGS.filter((s) => s !== slug)

  const cityLink = (citySlug: string, count: number) =>
    hub.cityFilter && count >= minFilterVenues(citySlug) ? `/soft-play/${citySlug}/${hub.cityFilter}` : `/soft-play/${citySlug}`

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Breadcrumbs items={[{ label: hub.h1.replace(/ Near You$/, '') }]} />
      <JsonLd data={buildBreadcrumbSchema([{ name: 'Home', url: SITE }, { name: hub.h1.replace(/ Near You$/, '') }])} />
      {buildFAQSchema(faqs) && <JsonLd data={buildFAQSchema(faqs)!} />}
      <TrackPageEvent name="category_view" params={{ category: slug }} />

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">{hub.h1}</h1>
        <p className="mt-3 text-sm font-medium text-slate-600">
          {venues.length} venues in {places} towns and cities across the UK
        </p>
        <div className="mt-6 space-y-4 text-slate-700 leading-relaxed">
          {hub.intro.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
          <p className="text-sm text-slate-500">{hub.basis}</p>
        </div>

        <nav aria-label="Jump to region" className="mt-8 flex flex-wrap gap-2">
          {regions.map((r) => (
            <a key={r.region} href={`#${r.region.toLowerCase().replace(/\W+/g, '-')}`} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50">
              {r.region} ({r.count})
            </a>
          ))}
        </nav>

        <section className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">{hub.choosing.heading}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
            {hub.choosing.points.map((p) => <li key={p.slice(0, 24)}>{p}</li>)}
          </ul>
        </section>

        <div className="mt-10 space-y-10">
          {regions.map((r) => (
            <section key={r.region} id={r.region.toLowerCase().replace(/\W+/g, '-')}>
              <h2 className="text-2xl font-semibold text-slate-900">{hub.label.charAt(0).toUpperCase() + hub.label.slice(1)} in {r.region}</h2>
              <div className="mt-4 space-y-6">
                {r.cities.map((c) => (
                  <div key={c.citySlug}>
                    <h3 className="text-lg font-semibold text-slate-800">
                      <Link href={cityLink(c.citySlug, c.venues.length)} className="hover:text-primary hover:underline">
                        {c.cityName}
                      </Link>
                      <span className="ml-2 text-sm font-normal text-slate-500">{c.venues.length} {c.venues.length === 1 ? 'venue' : 'venues'}</span>
                    </h3>
                    <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {c.venues.map((v) => {
                        const why = hub.reason(v)
                        const rating = Number(v.rating)
                        return (
                          <li key={v.slug} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2">
                            <Link href={`/soft-play/${v.city_slug}/${v.slug}`} className="font-medium text-slate-900 hover:text-primary hover:underline">
                              {v.name}
                            </Link>
                            <span className="text-sm text-slate-500">
                              {[
                                v.town && v.town !== c.cityName ? v.town : '',
                                why,
                                v.price_from != null && Number(v.price_from) > 0 ? `from £${Number(v.price_from).toFixed(2)}` : '',
                                rating > 0 ? `${rating.toFixed(1)}★ on Google` : '',
                              ].filter(Boolean).join(' · ')}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold text-slate-900">Questions parents ask</h2>
          <dl className="mt-4 space-y-5">
            {faqs.map((f) => (
              <div key={f.question}>
                <dt className="font-semibold text-slate-800">{f.question}</dt>
                <dd className="mt-1 text-slate-700 leading-relaxed">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 rounded-lg border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Related guides</h2>
          <ul className="mt-3 space-y-2">
            {hub.guides.map((g) => (
              <li key={g.href}><Link href={g.href} className="text-primary hover:underline">{g.label}</Link></li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            Also browse:{' '}
            {others.map((s, i) => (
              <span key={s}>
                {i > 0 && ' · '}
                <Link href={hubPath(s)} className="text-primary hover:underline">{HUBS[s].label}</Link>
              </span>
            ))}
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
