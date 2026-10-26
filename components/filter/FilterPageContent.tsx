import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { isUsablePhotoUrl } from '@/lib/imageUtils'
import { Badge } from '@/components/ui/badge'
import { getCityBySlug, getFilterBySlug, getNearbyCities } from '@/lib/venues'
import { getStaticVenuesByTown } from '@/lib/staticVenues'
import { MapPin, Star, Coffee, Car, Baby, PartyPopper, Heart, Globe, Navigation, CheckCircle2, Info } from 'lucide-react'
import { getPool, STATIC_BUILD } from '@/lib/pool'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema, buildCollectionPageSchema } from '@/lib/schema'
import { JsonLd } from '@/components/seo/JsonLd'
import { isOpenNow } from '@/lib/utils'
import { hasStructuredHours } from '@/lib/venueFacts'
import { isVisibleVenueType, visibleVenueTypeSql } from '@/lib/venueTypes'
import { splitByLocality, groupNearbyByLocality } from '@/lib/localities'
import { minFilterVenues } from '@/lib/hubGuides'
import { buildFilterMeta, isDataFilter } from '@/lib/filterMeta'
import { getCityVenueCount } from '@/lib/venueCounts'
import { getFilterContent, type FilterSlug } from '@/lib/filterContent'
import { getCardQuote, formatLastVerified } from '@/lib/venueCardText'
import { VenueCardFacts } from '@/components/venue/VenueCardFacts'

interface FilterVenue {
  id: number
  name: string
  slug: string
  address: string
  postcode: string
  description?: string
  review_snippet?: string | null
  last_verified_at?: string | null
  main_image_url?: string
  cafe: boolean
  parking: boolean
  parties: boolean
  toddler_area: boolean
  sen_friendly: boolean
  baby_area?: boolean
  avg_rating?: number
  review_count?: number
  opening_hours?: Record<string, unknown>
  opening_hours_text?: string | null
  price_from?: number | null
  price_to?: number | null
  age_range_min?: number | null
  age_range_max?: number | null
  age_ranges?: string[] | null
  website?: string
  venue_type?: string | null
}

interface FilteredVenues {
  venues: FilterVenue[]
  /** Whether any venue in the city has structured hours — i.e. whether "open now" can be answered at all. */
  hoursDataAvailable: boolean
}

async function getFilteredVenues(citySlug: string, filterSlug: FilterSlug): Promise<FilteredVenues> {
  const filterConfig = getFilterBySlug(filterSlug)
  const dbColumn = filterConfig?.dbColumn ?? null

  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      // Same scope as the city hub's main listing (genuine soft play only, see
      // lib/venueTypes.ts) so "N toddler-friendly venues" here matches the hub.
      // Open-now fetches all venues and filters client-side.
      const whereExtra = dbColumn ? `AND v.${dbColumn} = true` : ''
      const result = await client.query<FilterVenue>(
        `SELECT v.*,
                COALESCE(NULLIF(COALESCE(AVG(r.rating), 0), 0), v.rating::numeric) AS avg_rating,
                CASE WHEN COUNT(r.id) > 0 THEN COUNT(r.id) ELSE COALESCE(v.reviews_count, 0) END AS review_count
         FROM venues v
         LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
         WHERE v.city_slug = $1 AND v.is_active = true AND ${visibleVenueTypeSql()} ${whereExtra}
         GROUP BY v.id
         ORDER BY avg_rating DESC NULLS LAST, v.reviews_count DESC NULLS LAST, v.name ASC`,
        [citySlug]
      )
      const rows = result.rows

      if (filterSlug === 'open-now') {
        return {
          venues: rows.filter((v) => isOpenNow(v.opening_hours ?? null)),
          hoursDataAvailable: rows.some((v) => hasStructuredHours(v.opening_hours)),
        }
      }
      if (rows.length > 0) return { venues: rows, hoursDataAvailable: true }
    } finally {
      client.release()
    }
  } catch (error) {
    // Static builds skip the DB on purpose — don't log once per city/filter pair.
    if (!STATIC_BUILD) {
      console.error(`[FilterPage] DB error for ${citySlug}/${filterSlug}:`, error)
    }
  }

  // Static data fallback. The static export only has free-text hours, which
  // can't be checked against the clock, so "open now" can't be answered here.
  // (This used to fall through and list EVERY venue as open now.)
  if (filterSlug === 'open-now') return { venues: [], hoursDataAvailable: false }

  const staticVenues = getStaticVenuesByTown(citySlug).filter((v) => isVisibleVenueType(v.venueType))
  let filtered = staticVenues
  if (filterSlug === 'toddler') filtered = staticVenues.filter((v) => v.toddlerArea)
  else if (filterSlug === 'birthday-parties') filtered = staticVenues.filter((v) => v.parties)
  else if (filterSlug === 'sen-friendly') filtered = staticVenues.filter((v) => v.senFriendly)

  const venues = filtered.map((v) => ({
    id: 0,
    name: v.name,
    slug: v.slug,
    address: v.address,
    postcode: v.postcode,
    description: v.description || v.notes || undefined,
    main_image_url: v.mainImageUrl || undefined,
    cafe: v.cafe ?? false,
    parking: v.parking ?? false,
    parties: v.parties ?? false,
    toddler_area: v.toddlerArea ?? false,
    sen_friendly: v.senFriendly ?? false,
    baby_area: v.babyArea ?? false,
    avg_rating: v.rating ?? undefined,
    review_count: v.reviewCount ?? undefined,
    last_verified_at: v.lastVerified || undefined,
    opening_hours_text: v.openingHoursText || null,
    price_from: v.priceFrom ?? null,
    price_to: v.priceTo ?? null,
  }))
  return { venues, hoursDataAvailable: true }
}

/** Narrow a filter-page venue to what lib/cityStats.ts ranks on. */
function toStatsVenue(v: FilterVenue) {
  return {
    name: v.name,
    slug: v.slug,
    avg_rating: v.avg_rating ?? null,
    review_count: v.review_count ?? null,
  }
}

interface FilterPageContentProps {
  citySlug: string
  filterSlug: FilterSlug
}

export async function FilterPageContent({ citySlug, filterSlug }: FilterPageContentProps) {
  const cityConfig = getCityBySlug(citySlug)
  const filterConfig = getFilterBySlug(filterSlug)

  if (!cityConfig || !filterConfig) {
    notFound()
  }

  const { venues: fetched, hoursDataAvailable } = await getFilteredVenues(citySlug, filterSlug)
  // Same split as the hub: the town's own venues first, surrounding towns after.
  const { core: venues, nearby: nearbyVenues } = splitByLocality(citySlug, fetched)
  const nearbyGroups = groupNearbyByLocality(citySlug, nearbyVenues)
  const content = getFilterContent(filterSlug)
  const nearbyCities = getNearbyCities(citySlug).slice(0, 6)

  const cityName = cityConfig.name
  const h1 = filterConfig.h1Template.replace('{city}', cityName)
  // Short, data-driven intro (counts and best-rated names for THIS city) for the
  // data filters; the time-dependent "open now" page keeps its template.
  const intro = isDataFilter(filterSlug)
    ? buildFilterMeta(filterSlug, cityName, cityConfig.county, venues.map(toStatsVenue), await getCityVenueCount(citySlug)).intro
    : filterConfig.introTemplate.replace('{city}', cityName)
  const faqs = content.faqs(cityName)
  const advice = content.advice(cityName)

  const baseUrl = 'https://www.softplaynearme.co.uk'
  const canonicalUrl = `${baseUrl}/soft-play/${citySlug}/${filterSlug}`

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: `Soft Play in ${cityName}`, url: `${baseUrl}/soft-play/${citySlug}` },
    { name: filterConfig.name, url: canonicalUrl },
  ])
  const faqSchema = buildFAQSchema(faqs)
  const itemListSchema = buildItemListSchema(
    venues.map((v) => ({
      name: v.name,
      slug: v.slug,
      citySlug,
      address: v.address,
      postcode: v.postcode,
      avgRating: v.avg_rating ? Number(v.avg_rating) : undefined,
      reviewCount: v.review_count ? Number(v.review_count) : undefined,
      venueType: v.venue_type,
    })),
    `${filterConfig.name} in ${cityName}`
  )
  const collectionPageSchema = buildCollectionPageSchema({
    name: h1,
    description: intro,
    url: canonicalUrl,
  })

  const primaryBadgeIcon = filterSlug === 'toddler'
    ? <Baby className="w-3 h-3" />
    : filterSlug === 'birthday-parties'
      ? <PartyPopper className="w-3 h-3" />
      : filterSlug === 'sen-friendly'
        ? <Heart className="w-3 h-3" />
        : null

  // One venue card, shared by the main grid and the nearby-towns grids.
  const renderCard = (venue: FilterVenue, index: number) => {
        const displayImage = isUsablePhotoUrl(venue.main_image_url) ? venue.main_image_url : null
        return (
          <Card
            key={venue.slug}
            className="group hover:shadow-lg transition-all duration-200 border-slate-200 overflow-hidden flex flex-col h-full"
          >
            {/* Thumbnail */}
            <Link href={`/soft-play/${citySlug}/${venue.slug}`} tabIndex={-1} aria-hidden="true">
              <div className="h-32 relative overflow-hidden bg-slate-100 flex-shrink-0">
                {displayImage ? (
                  <Image
                    src={displayImage}
                    alt={`${venue.name} soft play`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${(index * 47 + 262) % 360}, 70%, 55%), hsl(${(index * 47 + 320) % 360}, 60%, 50%))`,
                    }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white/20 text-5xl font-bold select-none">{venue.name.charAt(0)}</span>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {venue.avg_rating && Number(venue.avg_rating) > 0 ? (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow text-xs font-bold">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-slate-800">{Number(venue.avg_rating).toFixed(1)}</span>
                    {venue.review_count && Number(venue.review_count) > 0 && (
                      <span className="text-slate-400 font-normal">({Number(venue.review_count).toLocaleString()})</span>
                    )}
                  </div>
                ) : null}
              </div>
            </Link>

            <div className="p-5 flex-1 flex flex-col">
              <Link href={`/soft-play/${citySlug}/${venue.slug}`} className="hover:text-purple-600 transition-colors">
                <h3 className="text-lg font-bold leading-tight line-clamp-2 mb-2">{venue.name}</h3>
              </Link>

              <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{venue.address || venue.postcode}</span>
              </div>

              <VenueCardFacts venue={venue} />

              {getCardQuote(venue.review_snippet) && (
                <p className="text-slate-600 text-sm mb-3 line-clamp-2 italic">
                  &ldquo;{getCardQuote(venue.review_snippet)}&rdquo;
                </p>
              )}

              {/* Feature badges — highlight the filter-relevant one */}
              <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                {filterSlug === 'toddler' && venue.toddler_area && (
                  <Badge variant="outline" className={`text-xs gap-1 ${content.badgeClasses}`}>
                    <Baby className="w-3 h-3" /> Toddler Area
                  </Badge>
                )}
                {filterSlug === 'birthday-parties' && venue.parties && (
                  <Badge variant="outline" className={`text-xs gap-1 ${content.badgeClasses}`}>
                    <PartyPopper className="w-3 h-3" /> Birthday Parties
                  </Badge>
                )}
                {filterSlug === 'sen-friendly' && venue.sen_friendly && (
                  <Badge variant="outline" className={`text-xs gap-1 ${content.badgeClasses}`}>
                    <Heart className="w-3 h-3" /> SEN Friendly
                  </Badge>
                )}
                {/* Secondary badges */}
                {filterSlug !== 'toddler' && venue.toddler_area && (
                  <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700 bg-blue-50">
                    <Baby className="w-3 h-3" /> Toddler
                  </Badge>
                )}
                {filterSlug !== 'birthday-parties' && venue.parties && (
                  <Badge variant="outline" className="text-xs gap-1 border-pink-200 text-pink-700 bg-pink-50">
                    <PartyPopper className="w-3 h-3" /> Parties
                  </Badge>
                )}
                {filterSlug !== 'sen-friendly' && venue.sen_friendly && (
                  <Badge variant="outline" className="text-xs gap-1 border-green-200 text-green-700 bg-green-50">
                    <Heart className="w-3 h-3" /> SEN
                  </Badge>
                )}
                {venue.cafe && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Coffee className="w-3 h-3" /> Cafe
                  </Badge>
                )}
                {venue.parking && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Car className="w-3 h-3" /> Parking
                  </Badge>
                )}
              </div>

              {formatLastVerified(venue.last_verified_at) && (
                <p className="text-xs text-slate-400 mt-2">
                  Verified {formatLastVerified(venue.last_verified_at)}
                </p>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
              <Button asChild className="flex-1 bg-purple-600 hover:bg-purple-700" size="sm">
                <Link href={`/soft-play/${citySlug}/${venue.slug}`}>View Details</Link>
              </Button>
              {venue.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={venue.website} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${venue.name} website`}>
                    <Globe className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </Card>
        )
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={itemListSchema} />
      <JsonLd data={collectionPageSchema} />

      <div className="min-h-screen bg-slate-50">
        <Header />
        <Breadcrumbs items={[
          { label: cityName, href: `/soft-play/${citySlug}` },
          { label: filterConfig.name },
        ]} />

        {/* Hero */}
        <div className={`bg-gradient-to-br ${content.heroGradient} text-white py-12 px-4`}>
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{h1}</h1>
            <p className="text-white/85 text-lg max-w-3xl">{intro}</p>
          </div>
        </div>

        <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
          {/* Count + back link */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              {venues.length} {venues.length === 1 ? 'venue' : 'venues'} found
            </h2>
            <Link href={`/soft-play/${citySlug}`}>
              <Button variant="outline" size="sm">View All in {cityName}</Button>
            </Link>
          </div>

          {/* Venue Grid */}
          {venues.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                {primaryBadgeIcon
                  ? <span className="text-slate-400 scale-[3]">{primaryBadgeIcon}</span>
                  : <MapPin className="w-8 h-8 text-slate-300" />}
              </div>
              {filterSlug === 'open-now' && !hoursDataAvailable ? (
                <>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">Opening hours not available yet</h3>
                  <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                    We don&apos;t hold checkable opening hours for {cityName} venues, so we can&apos;t say which are open right now.
                    Each venue page shows whatever hours we do have.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-semibold text-slate-700 mb-2">No {filterConfig.name.toLowerCase()} venues listed yet</h3>
                  <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                    Check back soon, or view all soft play venues in {cityName}.
                  </p>
                </>
              )}
              <Link href={`/soft-play/${citySlug}`}>
                <Button className="bg-purple-600 hover:bg-purple-700">View All Venues in {cityName}</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map(renderCard)}
            </div>
          )}

          {/* Venues in surrounding towns — same filter, kept apart from the town's own list */}
          {nearbyGroups.length > 0 && (
            <section aria-labelledby="filter-nearby-heading" className="mt-12">
              <h2 id="filter-nearby-heading" className="text-xl font-semibold mb-2">
                {filterConfig.name} near {cityName}
              </h2>
              <p className="text-slate-600 mb-6">Just outside {cityName}, in nearby towns.</p>
              {nearbyGroups.map((group) => (
                <div key={group.locality} className="mb-8">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">{group.locality}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.venues.map(renderCard)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Helpful Advice Section */}
          <section aria-labelledby="advice-heading" className="mt-12 bg-white rounded-xl border border-slate-200 p-8">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <h2 id="advice-heading" className="text-xl font-semibold">{advice.heading}</h2>
            </div>
            <ul className="space-y-3">
              {advice.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* FAQ Section */}
          <section aria-labelledby="filter-faq-heading" className="mt-12">
            <h2 id="filter-faq-heading" className="text-xl font-semibold mb-6">{content.faqHeading}</h2>
            <dl className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white p-6 rounded-lg border border-slate-200">
                  <dt className="font-semibold text-base mb-2">{faq.question}</dt>
                  <dd className="text-slate-600 text-sm leading-relaxed">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Nearby cities */}
          {nearbyCities.length > 0 && (
            <div className="mt-10">
              <h2 className="text-base font-semibold text-slate-600 mb-3">
                {filterConfig.name} Soft Play in Nearby Cities
              </h2>
              <div className="flex flex-wrap gap-2">
                {nearbyCities.map((city) => (
                  <Link key={city.slug} href={`/soft-play/${city.slug}/${filterSlug}`}>
                    <Badge
                      variant="outline"
                      className="hover:bg-purple-50 hover:border-purple-300 cursor-pointer py-1.5 px-3 text-sm"
                    >
                      {filterConfig.name} in {city.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Back link */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <Link href={`/soft-play/${citySlug}`} className="text-sm text-purple-600 hover:text-purple-700 font-medium">
              ← All soft play venues in {cityName}
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}

/** Shared generateMetadata logic — import and call from each filter page */
export async function buildFilterMetadata(citySlug: string, filterSlug: FilterSlug) {
  const cityConfig = getCityBySlug(citySlug)
  const filterConfig = getFilterBySlug(filterSlug)

  if (!cityConfig || !filterConfig) {
    return { title: 'Not Found | Soft Play Near Me' }
  }

  const content = getFilterContent(filterSlug)
  const { venues: fetched } = await getFilteredVenues(citySlug, filterSlug)
  const { core: venues } = splitByLocality(citySlug, fetched)

  // Unique per city: counts and best-rated names from this city's matching venues.
  const generated = isDataFilter(filterSlug)
    ? buildFilterMeta(filterSlug, cityConfig.name, cityConfig.county, venues.map(toStatsVenue), await getCityVenueCount(citySlug))
    : null
  const title = generated?.title ?? filterConfig.metaTitleTemplate.replace('{city}', cityConfig.name)
  const description = generated?.description ?? filterConfig.metaDescriptionTemplate.replace('{city}', cityConfig.name)
  const canonicalUrl = `https://www.softplaynearme.co.uk/soft-play/${citySlug}/${filterSlug}`

  return {
    title,
    description,
    // Noindex thin pages (no matching venues in this city for this filter) and
    // "open now" always: its result set changes by the minute, so it is never a
    // stable page worth indexing (it is also left out of the sitemap).
    ...((venues.length < minFilterVenues(citySlug) || filterSlug === 'open-now') && { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website' as const,
      siteName: 'Soft Play Near Me',
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: ['/opengraph-image'],
    },
    alternates: { canonical: canonicalUrl },
  }
}
