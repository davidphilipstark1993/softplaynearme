import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { isUsablePhotoUrl } from '@/lib/imageUtils'
import { getCityBySlug, getAllCitySlugs, getNearbyCities, filters } from '@/lib/venues'
import { MapPin, Star, Coffee, Car, Baby, PartyPopper, Heart, Phone, Globe, Navigation, TrendingUp, CheckCircle2, Sparkles, Compass } from 'lucide-react'
import type { Metadata } from 'next'
import { getPool, STATIC_BUILD } from '@/lib/pool'
import { getStaticVenuesByTown, getStaticTownBySlug, getAllStaticTownSlugs, type StaticVenue } from '@/lib/staticVenues'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { buildBreadcrumbSchema, buildFAQSchema, buildItemListSchema, buildCollectionPageSchema } from '@/lib/schema'
import { JsonLd } from '@/components/seo/JsonLd'
import { getLocationContent } from '@/lib/locationContent'
import { getPostForCity } from '@/lib/blogPosts'
import { LocationIntro } from '@/components/location/LocationIntro'
import { getCityOgImage } from '@/lib/cityImages'
import { formatAddressLine } from '@/lib/sanitize'
import { FilterSidebar, ActiveFilterBar } from '@/components/search/FilterSidebar'
import { isSoftPlayVenueType, VISIBLE_VENUE_TYPES, visibleVenueTypeSql } from '@/lib/venueTypes'
import { getCardQuote, formatLastVerified } from '@/lib/venueCardText'
import { isVerified } from '@/lib/plans'
import { FeaturedImpression } from '@/components/venue/FeaturedImpression'
import { LONDON_AREAS, getLondonAreaSlug } from '@/lib/londonAreas'

interface PageProps {
  params: Promise<{ city: string }>
  searchParams: Promise<{
    filter?: string    // legacy: links to SEO sub-pages
    search?: string
    age?: string        // comma-separated: under2, toddler
    facilities?: string // comma-separated: cafe, parking, sen, parties, outdoor
    price?: string      // single: under5 | 5to8 | over8
    special?: string    // comma-separated: open-now, wheelchair
    sort?: string
    area?: string       // London only: north-london, east-london, etc — see lib/londonAreas.ts
  }>
}

export const revalidate = 3600

export async function generateStaticParams() {
  const dbSlugs = getAllCitySlugs()
  const staticSlugs = getAllStaticTownSlugs()
  const allSlugs = [...new Set([...dbSlugs, ...staticSlugs])]
  return allSlugs.map((city) => ({ city }))
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { city } = await params
  const { filter, search, age, facilities, price, special, area } = await searchParams
  const cityConfig = getCityBySlug(city)

  // Prevent indexing of filtered / searched variations
  const noindex = !!(filter || search || age || facilities || price || special || area)

  if (!cityConfig) {
    const staticTown = getStaticTownBySlug(city)
    if (!staticTown) {
      // No suffix — the root layout's title template appends it. Never index a
      // not-found response, otherwise it inherits the root `index: true`.
      return { title: 'City Not Found', robots: { index: false, follow: false } }
    }

    // Use content generator for unique meta titles/descriptions
    const generated = getLocationContent(city, undefined, staticTown)
    const title = generated.metaTitle
    const description = generated.metaDescription

    const ogImage = getCityOgImage(city)
    return {
      title,
      description,
      ...(noindex && { robots: { index: false, follow: true } }),
      openGraph: {
        title,
        description,
        url: `https://www.softplaynearme.co.uk/soft-play/${city}`,
        type: 'website',
        siteName: 'Soft Play Near Me',
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: {
        canonical: `https://www.softplaynearme.co.uk/soft-play/${city}`,
      },
    }
  }

  // Use content generator for richer meta if hand-written is thin
  const generated = getLocationContent(city, cityConfig, null)
  const ogImage = getCityOgImage(city)

  return {
    title: generated.metaTitle,
    description: generated.metaDescription,
    ...(noindex && { robots: { index: false, follow: true } }),
    openGraph: {
      title: generated.metaTitle,
      description: generated.metaDescription,
      url: `https://www.softplaynearme.co.uk/soft-play/${city}`,
      type: 'website',
      siteName: 'Soft Play Near Me',
      images: [{ url: ogImage, width: 1200, height: 630, alt: generated.metaTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: generated.metaTitle,
      description: generated.metaDescription,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://www.softplaynearme.co.uk/soft-play/${city}`,
    },
  }
}

interface Venue {
  id?: number
  name: string
  slug: string
  address: string
  postcode: string
  main_image_url?: string | null
  phone?: string
  website?: string
  description?: string
  cafe?: boolean
  parking?: boolean
  parties?: boolean
  toddler_area?: boolean
  baby_area?: boolean
  has_under_1s?: boolean
  sen_friendly?: boolean
  has_outdoor_play?: boolean
  wheelchair_access?: boolean
  price_from?: number | null
  price_to?: number | null
  opening_hours?: unknown
  avg_rating?: number
  review_count?: number
  mapsUrl?: string
  notes?: string
  isStatic?: boolean
  venue_type?: string | null
  review_snippet?: string | null
  last_verified_at?: string | null
  featured?: boolean
  featured_until?: string | null
  plan?: string
  plan_status?: string
  claimed_by_owner?: boolean
}

interface VenueFilters {
  filter?: string    // legacy category filter
  search?: string
  age?: string[]
  facilities?: string[]
  price?: string
  special?: string[]
  sort?: string
  area?: string       // London only — see lib/londonAreas.ts
}

function staticToDisplayVenue(sv: StaticVenue): Venue {
  return {
    name: sv.name,
    slug: sv.slug,
    address: sv.address,
    postcode: sv.postcode,
    phone: sv.phone || undefined,
    website: sv.website || undefined,
    description: sv.description || sv.notes || undefined,
    mapsUrl: sv.mapsUrl || undefined,
    avg_rating: sv.rating ?? undefined,
    review_count: sv.reviewCount ?? undefined,
    cafe: sv.cafe ?? false,
    parking: sv.parking ?? false,
    parties: sv.parties ?? false,
    toddler_area: sv.toddlerArea ?? false,
    baby_area: sv.babyArea ?? false,
    has_under_1s: sv.babyArea ?? false, // approximate: babyArea covers under 2s
    sen_friendly: sv.senFriendly ?? false,
    has_outdoor_play: sv.hasOutdoorPlay ?? false,
    wheelchair_access: sv.wheelchairAccess ?? false,
    price_from: sv.priceFrom ?? null,
    price_to: sv.priceTo ?? null,
    isStatic: true,
    last_verified_at: sv.lastVerified || undefined,
    featured: sv.featured ?? false,
    venue_type: sv.venueType ?? null,
  }
}

async function getVenues(citySlug: string, opts: VenueFilters = {}): Promise<Venue[]> {
  const { filter, search, age = [], facilities = [], price = '', special = [], sort = 'rating', area = '' } = opts
  // London-only postcode-based area filter — not a DB column, so it's
  // applied as a post-fetch filter uniformly across both the live-DB and
  // static-fallback paths below rather than in SQL.
  const applyAreaFilter = (list: Venue[]): Venue[] =>
    citySlug === 'london' && area
      ? list.filter((v) => getLondonAreaSlug(v.postcode) === area)
      : list
  try {
    const pool = getPool()
    const client = await pool.connect()

    try {
      let query = `
        SELECT v.*,
               COALESCE(NULLIF(COALESCE(AVG(r.rating), 0), 0), v.rating::numeric) as avg_rating,
               CASE WHEN COUNT(r.id) > 0 THEN COUNT(r.id) ELSE COALESCE(v.reviews_count, 0) END as review_count
        FROM venues v
        LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
        WHERE v.city_slug = $1
      `
      const params: (string | boolean)[] = [citySlug]

      // Category scope: the main A-Z listing shows genuine soft play venues
      // only. Non-soft-play venues (trampoline parks, play farms, park
      // playgrounds, other family attractions — see lib/venueTypes.ts) are
      // tagged via venue_type and surfaced instead through the dedicated
      // "other" filter tab, rather than diluting every other view.
      if (filter === 'other') {
        query += ` AND v.venue_type IS NOT NULL AND v.venue_type NOT IN ('${VISIBLE_VENUE_TYPES.join("','")}')`
      } else {
        query += ` AND ${visibleVenueTypeSql()}`
      }

      // Legacy category filter (from SEO sub-pages)
      if (filter === 'cafe') query += ` AND v.cafe = true`
      else if (filter === 'parking') query += ` AND v.parking = true`
      else if (filter === 'parties') query += ` AND v.parties = true`
      else if (filter === 'toddler') query += ` AND v.toddler_area = true`
      else if (filter === 'sen') query += ` AND v.sen_friendly = true`

      // Age group filters
      if (age.includes('under2')) query += ` AND (v.baby_area = true OR v.has_under_1s = true)`
      if (age.includes('toddler')) query += ` AND v.toddler_area = true`

      // Facility filters
      if (facilities.includes('cafe')) query += ` AND v.cafe = true`
      if (facilities.includes('parking')) query += ` AND v.parking = true`
      if (facilities.includes('sen')) query += ` AND v.sen_friendly = true`
      if (facilities.includes('parties')) query += ` AND v.parties = true`
      if (facilities.includes('outdoor')) query += ` AND v.has_outdoor_play = true`

      // Price range filters
      if (price === 'under5') query += ` AND v.price_from IS NOT NULL AND v.price_from < 5`
      else if (price === '5to8') query += ` AND v.price_from IS NOT NULL AND v.price_from >= 5 AND v.price_from <= 8`
      else if (price === 'over8') query += ` AND v.price_from IS NOT NULL AND v.price_from > 8`

      // Special filters
      if (special.includes('wheelchair')) query += ` AND v.wheelchair_access = true`

      // Text search
      if (search) {
        params.push(`%${search}%`)
        query += ` AND (v.name ILIKE $${params.length} OR v.description ILIKE $${params.length})`
      }

      // Sort
      const sortMap: Record<string, string> = {
        rating: 'avg_rating DESC NULLS LAST, v.reviews_count DESC NULLS LAST, v.name ASC',
        price_low: 'v.price_from ASC NULLS LAST, avg_rating DESC NULLS LAST',
        price_high: 'v.price_to DESC NULLS LAST, avg_rating DESC NULLS LAST',
        name: 'v.name ASC',
      }
      // Featured (Premium/Bespoke) venues surface first regardless of sort —
      // but only while any sponsored placement is still within its
      // featured_until expiry (NULL means indefinite).
      query += ` GROUP BY v.id ORDER BY (v.featured AND (v.featured_until IS NULL OR v.featured_until > NOW())) DESC, ${sortMap[sort] ?? sortMap.rating}`

      const result = await client.query(query, params)

      let venues: Venue[] = result.rows.map((row: Venue) => ({
        ...row,
        featured: !!row.featured && (!row.featured_until || new Date(row.featured_until) > new Date()),
      }))
      if (special.includes('open-now') && venues.length > 0) {
        const { isOpenNow } = await import('@/lib/utils')
        venues = venues.filter((v) => isOpenNow(v.opening_hours as Record<string, unknown>))
      }
      venues = applyAreaFilter(venues)
      if (venues.length > 0) return venues
    } finally {
      client.release()
    }
  } catch (error) {
    // Static builds skip the DB on purpose — don't log once per page for that.
    if (!STATIC_BUILD) {
      console.error('Database unavailable, falling back to static data:', error)
    }
  }

  // Static data fallback with client-side filtering
  const staticVenues = getStaticVenuesByTown(citySlug)
  let venues = staticVenues.map(staticToDisplayVenue)

  // Category scope: mirror the live-DB query's venue_type inclusion/exclusion
  // above — this branch runs at build time under SOFTPLAY_STATIC_BUILD, so
  // without this filter every static production build would show excluded
  // categories (park playgrounds, mobile hire, retail, etc.) in the main
  // listing regardless of the DB-side fix.
  venues =
    filter === 'other'
      ? venues.filter((v) => v.venue_type != null && !(VISIBLE_VENUE_TYPES as readonly string[]).includes(v.venue_type))
      : venues.filter((v) => v.venue_type == null || (VISIBLE_VENUE_TYPES as readonly string[]).includes(v.venue_type))

  if (filter === 'toddler') venues = venues.filter((v) => v.toddler_area)
  if (filter === 'sen') venues = venues.filter((v) => v.sen_friendly)
  if (filter === 'cafe') venues = venues.filter((v) => v.cafe)
  if (filter === 'parking') venues = venues.filter((v) => v.parking)
  if (filter === 'parties') venues = venues.filter((v) => v.parties)

  if (age.includes('under2')) venues = venues.filter((v) => v.baby_area || v.has_under_1s)
  if (age.includes('toddler')) venues = venues.filter((v) => v.toddler_area)
  if (facilities.includes('cafe')) venues = venues.filter((v) => v.cafe)
  if (facilities.includes('parking')) venues = venues.filter((v) => v.parking)
  if (facilities.includes('sen')) venues = venues.filter((v) => v.sen_friendly)
  if (facilities.includes('parties')) venues = venues.filter((v) => v.parties)
  if (facilities.includes('outdoor')) venues = venues.filter((v) => v.has_outdoor_play)
  if (price === 'under5') venues = venues.filter((v) => v.price_from != null && v.price_from < 5)
  if (price === '5to8') venues = venues.filter((v) => v.price_from != null && v.price_from >= 5 && v.price_from <= 8)
  if (price === 'over8') venues = venues.filter((v) => v.price_from != null && v.price_from > 8)
  if (special.includes('wheelchair')) venues = venues.filter((v) => v.wheelchair_access)

  if (search) {
    const q = search.toLowerCase()
    venues = venues.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q))
    )
  }

  if (sort === 'price_low') venues.sort((a, b) => (a.price_from ?? Infinity) - (b.price_from ?? Infinity))
  else if (sort === 'name') venues.sort((a, b) => a.name.localeCompare(b.name))

  // Featured (Premium/Bespoke) venues surface first regardless of sort —
  // stable sort preserves the ordering above as the secondary key, matching
  // the `ORDER BY v.featured DESC, ...` behaviour of the live-DB query.
  venues.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))

  return applyAreaFilter(venues)
}

interface SponsoredVenue {
  id: number
  name: string
  slug: string
}

/**
 * Bespoke-plan sponsored slot for a specific city page (distinct from the
 * homepage slot in app/page.tsx) — admin-placed via ad_placements.city_pages,
 * e.g. {"city_pages": ["london"]}. Live-DB only; degrades to empty on
 * static builds like the homepage equivalent, so it just doesn't render
 * rather than erroring.
 */
async function getSponsoredCityVenues(citySlug: string): Promise<SponsoredVenue[]> {
  try {
    const pool = getPool()
    const result = await pool.query<SponsoredVenue>(
      `SELECT id, name, slug FROM venues
       WHERE city_slug = $1 AND ad_placements -> 'city_pages' ? $1
       ORDER BY RANDOM()
       LIMIT 3`,
      [citySlug]
    )
    return result.rows
  } catch {
    return []
  }
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city } = await params
  const { filter, search, age: ageParam, facilities: facilitiesParam, price, special: specialParam, sort, area } = await searchParams
  const cityConfig = getCityBySlug(city)
  const staticTown = getStaticTownBySlug(city)

  if (!cityConfig && !staticTown) {
    notFound()
  }

  const displayName = cityConfig?.name || staticTown?.name || city
  const county = cityConfig?.county || ''
  const nearbyAreas = cityConfig?.nearbyAreas || []

  const age = (ageParam || '').split(',').filter(Boolean)
  const facilities = (facilitiesParam || '').split(',').filter(Boolean)
  const special = (specialParam || '').split(',').filter(Boolean)

  const venues = await getVenues(city, { filter, search, age, facilities, price, special, sort, area })
  const nearbyCities = cityConfig ? getNearbyCities(city) : []

  // Popular-areas counts for London — a second, unfiltered fetch so the area
  // pills always show true totals regardless of whatever filters are active.
  const londonAreaCounts: Record<string, number> = {}
  if (city === 'london') {
    const allLondonVenues = await getVenues('london', {})
    for (const v of allLondonVenues) {
      const slug = getLondonAreaSlug(v.postcode)
      if (slug) londonAreaCounts[slug] = (londonAreaCounts[slug] || 0) + 1
    }
  }

  // Use content generator for rich intros and FAQs
  const locationContent = getLocationContent(city, cityConfig, staticTown, venues.length)
  const { h1, intro, faqs } = locationContent

  const baseUrl = 'https://www.softplaynearme.co.uk'

  // Use reusable schema builders from lib/schema.ts
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    ...(county ? [{ name: county }] : []),
    { name: `Soft Play in ${displayName}`, url: `${baseUrl}/soft-play/${city}` },
  ])

  const faqSchema = buildFAQSchema(faqs)

  const itemListSchema = buildItemListSchema(
    venues.map(v => ({
      name: v.name,
      slug: v.slug,
      citySlug: city,
      address: v.address,
      postcode: v.postcode,
      avgRating: v.avg_rating ? Number(v.avg_rating) : undefined,
      reviewCount: v.review_count ? Number(v.review_count) : undefined,
    })),
    `Soft Play Centres in ${displayName}`
  )

  const collectionPageSchema = buildCollectionPageSchema({
    name: h1,
    description: locationContent.metaDescription,
    url: `${baseUrl}/soft-play/${city}`,
  })

  // Curated spotlight sections (only shown on fully unfiltered city pages).
  // Restricted to genuine soft play venues — trampoline parks, play farms,
  // and other family attractions shouldn't rank in soft-play-specific
  // modules even though they may still appear in the main listing.
  const hasActiveFilters = !!(filter || search || age.length || facilities.length || price || special.length || area)
  const showCurated = !hasActiveFilters && venues.length >= 4
  const softPlayVenues = venues.filter(v => isSoftPlayVenueType(v.venue_type))
  // Featured (Premium/Bespoke) venues get their own spotlight, shown ahead of
  // the others — a single featured venue is still worth surfacing since it's
  // a paid placement, unlike the other categories which need a few to look
  // like a real "best of" grid.
  const featuredVenues = showCurated ? softPlayVenues.filter(v => v.featured).slice(0, 4) : []
  const sponsoredVenues = showCurated ? await getSponsoredCityVenues(city) : []
  const toddlerVenues = showCurated ? softPlayVenues.filter(v => v.toddler_area).slice(0, 4) : []
  // A minimum review count keeps a single 5-star fluke review from
  // outranking a venue with hundreds of consistently good ones; a maximum
  // keeps a review-count outlier (mistagged big attraction, franchise HQ
  // listing, etc.) from dominating "most popular" regardless of whether
  // venue_type classification catches it. See reports/ for the review-count
  // outlier audit that found several misclassified venues this way.
  const MIN_REVIEWS_FOR_CURATED = 5
  const MAX_REVIEWS_FOR_POPULAR = 5000
  const topRatedVenues = showCurated
    ? [...softPlayVenues].filter(v => v.avg_rating && Number(v.avg_rating) > 0 && Number(v.review_count || 0) >= MIN_REVIEWS_FOR_CURATED).sort((a, b) => Number(b.avg_rating || 0) - Number(a.avg_rating || 0)).slice(0, 4)
    : []
  const cityBlogPost = getPostForCity(displayName)

  const mostPopularVenues = showCurated
    ? [...softPlayVenues]
        .filter(v => v.review_count && Number(v.review_count) >= MIN_REVIEWS_FOR_CURATED && Number(v.review_count) <= MAX_REVIEWS_FOR_POPULAR)
        .sort((a, b) => Number(b.review_count || 0) - Number(a.review_count || 0))
        .slice(0, 4)
    : []

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={itemListSchema} />
      <JsonLd data={collectionPageSchema} />

      <div className="min-h-screen bg-slate-50">
        <Header />

        <Breadcrumbs items={[
          ...(county ? [{ label: county }] : []),
          { label: `Soft Play in ${displayName}` },
        ]} />

        {/* Hero */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-10 sm:py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">{h1}</h1>
            <p className="text-purple-100 text-lg max-w-3xl">
              Find and compare soft play centres in {displayName}{county ? `, ${county}` : ''}. Browse venues, check facilities, and plan your visit.
            </p>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="bg-white border-b border-slate-200 py-3 px-4">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><strong className="text-slate-900">{venues.length}</strong> <span className="text-slate-500">{venues.length === 1 ? 'venue' : 'venues'} in {displayName}</span></span>
            {city === 'london' && (
              <span><strong className="text-slate-900">£7&ndash;£14</strong> <span className="text-slate-500">per child, typical session &mdash; under-1s usually free</span></span>
            )}
          </div>
        </div>

        {city === 'hull' && (
          <div className="bg-purple-50 border-b border-purple-100 py-3 px-4">
            <div className="max-w-7xl mx-auto text-sm text-purple-900">
              New to Hull&apos;s soft play scene?{' '}
              <Link href="/blog/best-soft-play-in-hull" className="font-semibold underline hover:text-purple-700">
                Read our local guide to soft play in Hull
              </Link>{' '}
              — venues compared by age, parties and sensory needs.
            </div>
          </div>
        )}

        {/* Sticky Filters */}
        <div className="bg-white border-b border-slate-200 py-3 sticky top-16 z-40">
          <div className="max-w-7xl mx-auto px-4 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              <Link href={`/soft-play/${city}`}>
                <Button variant={!filter ? 'default' : 'outline'} size="sm" className={!filter ? 'bg-purple-600' : ''}>
                  All Venues
                </Button>
              </Link>
              {filters.map((f) => (
                <Link key={f.slug} href={`/soft-play/${city}/${f.slug}`}>
                  <Button variant="outline" size="sm">
                    {f.name}
                  </Button>
                </Link>
              ))}
              <Link href={`/soft-play/${city}?filter=other`}>
                <Button variant={filter === 'other' ? 'default' : 'outline'} size="sm" className={filter === 'other' ? 'bg-purple-600' : ''}>
                  Other Family Activities
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="lg:grid lg:grid-cols-4 lg:gap-8">

            {/* Filter sidebar — sticky on desktop, collapsible on mobile */}
            <aside className="lg:col-span-1 mb-6 lg:mb-0">
              {/* Mobile sticky filter bar */}
              <div className="lg:hidden sticky top-[104px] z-30 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
                <FilterSidebar showSort />
              </div>
              {/* Desktop sidebar */}
              <div className="hidden lg:block sticky top-24">
                <FilterSidebar showSort />
              </div>
            </aside>

            {/* Venue content */}
            <article className="lg:col-span-3">
              {/* Active filter chips */}
              <ActiveFilterBar className="mb-4" />

          {/* Curated Spotlight Sections */}
          {showCurated && (
            <div className="mb-10 space-y-8">
              {featuredVenues.length >= 1 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-slate-800">Featured in {displayName}</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {featuredVenues.map((venue) => (
                      <Link
                        key={venue.slug}
                        href={`/soft-play/${city}/${venue.slug}`}
                        className="group block"
                        data-ga-featured={venue.id}
                      >
                        <div className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:border-purple-400 hover:shadow-md transition-all h-full flex flex-col">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5 mb-2 w-fit">
                            <Sparkles className="w-3 h-3" /> Featured
                          </span>
                          <p className="font-semibold text-sm text-slate-800 group-hover:text-purple-600 line-clamp-2 flex-1">{venue.name}</p>
                          {venue.avg_rating && Number(venue.avg_rating) > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              <span className="font-medium text-slate-700">{Number(venue.avg_rating).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {sponsoredVenues.length >= 1 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2.5 py-1">
                      Sponsored
                    </span>
                    <span className="text-xs text-slate-400">Placed by our Bespoke partners</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {sponsoredVenues.map((venue) => (
                      <Link
                        key={venue.slug}
                        href={`/soft-play/${city}/${venue.slug}`}
                        className="group block"
                        data-ga-featured={venue.id}
                      >
                        <div className="bg-white border-2 border-amber-200 rounded-lg p-4 hover:border-amber-400 hover:shadow-md transition-all h-full flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-2">Sponsored</span>
                          <p className="font-semibold text-sm text-slate-800 group-hover:text-amber-700 line-clamp-2">{venue.name}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {toddlerVenues.length >= 2 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Baby className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-slate-800">Best for Toddlers in {displayName}</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {toddlerVenues.map((venue) => (
                      <Link key={venue.slug} href={`/soft-play/${city}/${venue.slug}`} className="group block">
                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all h-full flex flex-col">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 mb-2 w-fit">
                            <Baby className="w-3 h-3" /> Toddler Friendly
                          </span>
                          <p className="font-semibold text-sm text-slate-800 group-hover:text-blue-600 line-clamp-2 flex-1">{venue.name}</p>
                          {venue.avg_rating && Number(venue.avg_rating) > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              <span className="font-medium text-slate-700">{Number(venue.avg_rating).toFixed(1)}</span>
                              {venue.review_count && Number(venue.review_count) > 0 && (
                                <span>({Number(venue.review_count).toLocaleString()})</span>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {topRatedVenues.length >= 2 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-yellow-500 fill-current" />
                    <h2 className="text-lg font-semibold text-slate-800">Top Rated Soft Play in {displayName}</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {topRatedVenues.map((venue) => (
                      <Link key={venue.slug} href={`/soft-play/${city}/${venue.slug}`} className="group block">
                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-yellow-300 hover:shadow-md transition-all h-full flex flex-col">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5 mb-2 w-fit">
                            <Star className="w-3 h-3 fill-current" /> {Number(venue.avg_rating).toFixed(1)} rated
                          </span>
                          <p className="font-semibold text-sm text-slate-800 group-hover:text-yellow-600 line-clamp-2 flex-1">{venue.name}</p>
                          {venue.review_count && Number(venue.review_count) > 0 && (
                            <p className="mt-2 text-xs text-slate-500">{Number(venue.review_count).toLocaleString()} reviews</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {mostPopularVenues.length >= 2 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-slate-800">Most Popular in {displayName}</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {mostPopularVenues.map((venue) => (
                      <Link key={venue.slug} href={`/soft-play/${city}/${venue.slug}`} className="group block">
                        <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all h-full flex flex-col">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5 mb-2 w-fit">
                            <TrendingUp className="w-3 h-3" /> {Number(venue.review_count).toLocaleString()} reviews
                          </span>
                          <p className="font-semibold text-sm text-slate-800 group-hover:text-purple-600 line-clamp-2 flex-1">{venue.name}</p>
                          {venue.avg_rating && Number(venue.avg_rating) > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                              <Star className="w-3 h-3 text-yellow-400 fill-current" />
                              <span className="font-medium text-slate-700">{Number(venue.avg_rating).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {/* All Venues */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-700">
              {showCurated ? `All Soft Play in ${displayName} ` : ''}{venues.length} {venues.length === 1 ? 'venue' : 'venues'}{!showCurated ? ' found' : ''}
            </h2>
          </div>

          {/* Venues Grid */}
          {venues.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No venues found yet</h3>
              <p className="text-slate-500 mb-6">We&apos;re still building our directory for {displayName}.</p>
              <Link href="/add-venue">
                <Button className="bg-purple-600 hover:bg-purple-700">Add a Venue</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map((venue, index) => {
                const hasFeatures = venue.toddler_area || venue.parties || venue.cafe || venue.parking || venue.sen_friendly
                const displayImage = isUsablePhotoUrl(venue.main_image_url) ? venue.main_image_url : null
                return (
                <Card key={venue.slug} className="group hover:shadow-lg transition-all duration-200 border-slate-200 overflow-hidden h-full flex flex-col">
                  {/* Venue thumbnail banner */}
                  <Link
                    href={`/soft-play/${city}/${venue.slug}`}
                    className="block"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-ga-featured={venue.featured ? venue.id : undefined}
                  >
                    <div className="h-36 relative overflow-hidden bg-slate-100">
                      {displayImage ? (
                        <Image
                          src={displayImage}
                          alt={`${venue.name} soft play venue`}
                          fill
                          loading="lazy"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(135deg, hsl(${(index * 47 + 262) % 360}, 70%, 55%), hsl(${(index * 47 + 320) % 360}, 60%, 50%))`,
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white/20 text-6xl font-bold select-none">
                              {venue.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
                      {/* Featured / Verified overlay */}
                      {(venue.featured || isVerified(venue)) && (
                        <div className="absolute top-2 left-2 flex gap-1">
                          {venue.featured && <FeaturedImpression venueId={venue.id} city={city} />}
                          {venue.featured && (
                            <Badge className="bg-yellow-400 text-yellow-900 text-xs">Featured</Badge>
                          )}
                          {isVerified(venue) && (
                            <Badge className="bg-blue-500 text-white text-xs inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </Badge>
                          )}
                        </div>
                      )}
                      {/* Rating overlay */}
                      {venue.avg_rating && venue.avg_rating > 0 ? (
                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow text-xs font-bold">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span className="text-slate-800">{Number(venue.avg_rating).toFixed(1)}</span>
                          {venue.review_count && venue.review_count > 0 && (
                            <span className="text-slate-400 font-normal">({venue.review_count.toLocaleString()})</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </Link>

                  <div className="p-5 flex-1 flex flex-col">
                    {/* Venue name */}
                    <Link
                      href={`/soft-play/${city}/${venue.slug}`}
                      className="hover:text-purple-600 transition-colors"
                      data-ga-featured={venue.featured ? venue.id : undefined}
                    >
                      <h3 className="text-lg font-bold leading-tight line-clamp-2 mb-2">
                        {venue.name}
                      </h3>
                    </Link>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{venue.address || venue.postcode}</span>
                    </div>

                    {/* Genuine review quote only — never the generic AI description */}
                    {getCardQuote(venue.review_snippet) && (
                      <p className="text-slate-600 text-sm mb-3 line-clamp-2 italic">
                        &ldquo;{getCardQuote(venue.review_snippet)}&rdquo;
                      </p>
                    )}

                    {/* Feature badges */}
                    {hasFeatures && (
                      <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                        {venue.toddler_area && (
                          <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-700 bg-blue-50">
                            <Baby className="w-3 h-3" /> Toddler
                          </Badge>
                        )}
                        {venue.parties && (
                          <Badge variant="outline" className="text-xs gap-1 border-pink-200 text-pink-700 bg-pink-50">
                            <PartyPopper className="w-3 h-3" /> Parties
                          </Badge>
                        )}
                        {venue.sen_friendly && (
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
                    )}

                    {formatLastVerified(venue.last_verified_at) && (
                      <p className="text-xs text-slate-400 mt-2">
                        Verified {formatLastVerified(venue.last_verified_at)}
                      </p>
                    )}
                  </div>

                  {/* CTA footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <Button asChild className="flex-1 bg-purple-600 hover:bg-purple-700" size="sm">
                      <Link href={`/soft-play/${city}/${venue.slug}`}>
                        View Details
                      </Link>
                    </Button>
                    {venue.website && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={venue.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Visit ${venue.name} website`}
                        >
                          <Globe className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {(venue.mapsUrl || formatAddressLine(venue.address, venue.postcode)) && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={venue.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formatAddressLine(venue.address, venue.postcode)!)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Get directions to ${venue.name}`}
                        >
                          <Navigation className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </Card>
              )})}
            </div>
          )}

          {/* Blog post link — shown when a guide exists for this city */}
          {cityBlogPost && (
            <div className="mt-12">
              <Link
                href={`/blog/${cityBlogPost.slug}`}
                className="group flex items-start gap-4 rounded-xl border border-purple-200 bg-purple-50 p-5 hover:bg-purple-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-1">Parent Guide</p>
                  <h2 className="text-base font-bold text-slate-900 group-hover:text-purple-700 leading-snug">{cityBlogPost.title}</h2>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-2">{cityBlogPost.excerpt}</p>
                </div>
                <span className="text-purple-500 mt-1 shrink-0">→</span>
              </Link>
            </div>
          )}

          {/* Category Links */}
          <section aria-labelledby="category-heading" className="mt-12">
            <h2 id="category-heading" className="text-xl font-semibold mb-4">Browse by Category in {displayName}</h2>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <Link key={f.slug} href={`/soft-play/${city}/${f.slug}`}>
                  <Badge variant="outline" className="hover:bg-purple-50 hover:border-purple-300 cursor-pointer py-1.5 px-3">
                    {f.name} in {displayName}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>

          {/* Popular Areas — London only, postcode-derived */}
          {city === 'london' && (
            <section aria-labelledby="london-areas-heading" className="mt-12">
              <div className="flex items-center gap-2 mb-4">
                <Compass className="w-5 h-5 text-purple-600" />
                <h2 id="london-areas-heading" className="text-xl font-semibold">Popular Areas in London</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {LONDON_AREAS.map((a) => {
                  const count = londonAreaCounts[a.slug] || 0
                  const isActive = area === a.slug
                  return (
                    <Link key={a.slug} href={isActive ? `/soft-play/london` : `/soft-play/london?area=${a.slug}`}>
                      <Badge
                        variant="outline"
                        className={
                          isActive
                            ? 'bg-purple-600 text-white border-purple-600 cursor-pointer py-1.5 px-3'
                            : 'hover:bg-purple-50 hover:border-purple-300 cursor-pointer py-1.5 px-3'
                        }
                      >
                        {a.name}{count > 0 && <span className={isActive ? 'text-purple-100' : 'text-slate-400'}> ({count})</span>}
                      </Badge>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {/* Nearby Areas */}
          {(nearbyCities.length > 0 || nearbyAreas.length > 0) && (
            <section aria-labelledby="nearby-areas-heading" className="mt-12">
              <h2 id="nearby-areas-heading" className="text-xl font-semibold mb-4">Nearby Areas</h2>
              <div className="flex flex-wrap gap-2">
                {nearbyAreas.map((area) => {
                  const nearbyCity = nearbyCities.find(c => c.name === area)
                  if (nearbyCity) {
                    return (
                      <Link key={area} href={`/soft-play/${nearbyCity.slug}`}>
                        <Badge variant="outline" className="hover:bg-purple-50 hover:border-purple-300 cursor-pointer py-1.5 px-3">
                          {area}
                        </Badge>
                      </Link>
                    )
                  }
                  return (
                    <Badge key={area} variant="outline" className="text-slate-400 py-1.5 px-3">
                      {area}
                    </Badge>
                  )
                })}
              </div>
            </section>
          )}

          {/* Location Intro (SEO content) */}
          <LocationIntro content={intro} locationName={displayName} />

          {/* FAQs */}
          {faqs.length > 0 && (
            <section aria-labelledby="city-faq-heading" className="mt-12">
              <h2 id="city-faq-heading" className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
              <dl className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg border border-slate-200">
                    <dt className="font-semibold text-lg mb-2">{faq.question}</dt>
                    <dd className="text-slate-600">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

            </article> {/* end venue content col */}
          </div> {/* end lg:grid */}
        </main>

        <Footer />
      </div>
    </>
  )
}
