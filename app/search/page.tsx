import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPool } from '@/lib/pool'
import { geocodePostcode, geocodeOutcode, isUKOutcode, parseRadius, formatPostcode, isValidUKPostcode } from '@/lib/geo'
import { visibleVenueTypeSql } from '@/lib/venueTypes'
import { citiesBasic } from '@/lib/cityBasics'
import { getStaticTowns } from '@/lib/staticTowns'
import { SearchForm } from '@/components/search/SearchForm'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from './SearchFilters'
import { mergeLegacyFilters, hasSearchQuery } from '@/lib/searchFilters'
import { ActiveFilterBar } from '@/components/search/FilterSidebar'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    lat?: string
    lng?: string
    radius?: string
    // New structured filter params
    age?: string        // comma-separated: under2, toddler
    facilities?: string // comma-separated: cafe, parking, sen, parties, outdoor
    price?: string      // single: under5 | 5to8 | over8
    special?: string    // comma-separated: open-now, wheelchair
    sort?: string
    filters?: string    // legacy: /search?filters=toddler — folded into the params above
  }>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams
  const query = params.q

  // Every parameterised /search URL is a one-off view (a postcode, a filter, a
  // sort) with no content of its own to rank — noindex,follow, canonical to the
  // plain /search. The bare /search landing page stays indexable. The indexable
  // filter pages are the path versions: /soft-play/{city}/toddler etc.
  const robots = hasSearchQuery(params) ? { index: false, follow: true } : undefined

  if (query) {
    const title = `Soft Play Near ${query} | Find Local Indoor Play Centres`
    const description = `Discover the best soft play centres near ${query}. Find venues with cafes, toddler areas, birthday parties, and more.`
    return {
      title,
      description,
      robots,
      openGraph: { title, description, url: 'https://www.softplaynearme.co.uk/search', type: 'website', siteName: 'Soft Play Near Me' },
      twitter: { card: 'summary_large_image', title, description },
      alternates: { canonical: 'https://www.softplaynearme.co.uk/search' },
    }
  }

  // The root layout applies `template: "%s | Soft Play Near Me"`, so `title` must
  // NOT repeat the suffix. Social cards bypass the template, so they keep it.
  const title = 'Search Soft Play Centres'
  const socialTitle = 'Search Soft Play Centres | Soft Play Near Me'
  const description = 'Search for soft play centres near you. Filter by facilities, distance, and more to find the perfect venue for your family.'
  return {
    title,
    description,
    robots,
    openGraph: { title: socialTitle, description, url: 'https://www.softplaynearme.co.uk/search', type: 'website', siteName: 'Soft Play Near Me' },
    twitter: { card: 'summary_large_image', title: socialTitle, description },
    alternates: { canonical: 'https://www.softplaynearme.co.uk/search' },
  }
}

/** Venues whose name contains the query: for "jungle jims" typed into the search box. */
async function searchVenuesByName(query: string) {
  const q = query.trim()
  if (q.length < 3) return []
  try {
    const { rows } = await getPool().query(
      `SELECT v.*, v.rating AS avg_rating, COALESCE(v.reviews_count, 0) AS review_count
         FROM venues v
        WHERE v.is_active = true AND ${visibleVenueTypeSql('v')}
          AND v.name ILIKE '%' || $1 || '%'
        ORDER BY v.featured DESC, v.reviews_count DESC NULLS LAST, v.name
        LIMIT 30`,
      [q.replace(/[%_\\]/g, (c) => `\\${c}`)],
    )
    return rows
  } catch (error) {
    console.error('Name search error:', error)
    return []
  }
}

/** Towns and cities whose name starts with the query ("brad" → Bradford), for the no-match state. */
function suggestPlaces(query: string) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const seen = new Set<string>()
  return [...citiesBasic.map((c) => ({ name: c.name, slug: c.slug })), ...getStaticTowns().map((t) => ({ name: t.name, slug: t.slug }))]
    .filter((p) => p.name.toLowerCase().startsWith(q) && !seen.has(p.slug) && seen.add(p.slug))
    .slice(0, 8)
}

async function searchVenues(
  lat: number,
  lng: number,
  radius: number,
  age: string[],
  facilities: string[],
  price: string,
  special: string[],
  sort: string
) {
  let client
  try {
    client = await getPool().connect()

    const queryParams: (number | string)[] = [lat, lng]
    // Same venue types the city pages list — not the hidden 'other activities'.
    const where: string[] = ['v.is_active = true', visibleVenueTypeSql('v')]

    const latDegPerMile = 1 / 69.0
    const lngDegPerMile = 1 / (69.0 * Math.cos((lat * Math.PI) / 180))
    where.push(`v.lat BETWEEN ${lat - radius * latDegPerMile} AND ${lat + radius * latDegPerMile}`)
    where.push(`v.lng BETWEEN ${lng - radius * lngDegPerMile} AND ${lng + radius * lngDegPerMile}`)

    // Age group filters
    if (age.includes('under2')) where.push('(v.baby_area = true OR v.has_under_1s = true)')
    if (age.includes('toddler')) where.push('v.toddler_area = true')

    // Facility filters
    if (facilities.includes('cafe')) where.push('v.cafe = true')
    if (facilities.includes('parking')) where.push('v.parking = true')
    if (facilities.includes('sen')) where.push('v.sen_friendly = true')
    if (facilities.includes('parties')) where.push('v.parties = true')
    if (facilities.includes('outdoor')) where.push('v.has_outdoor_play = true')

    // Price range filters
    if (price === 'under5') where.push('v.price_from IS NOT NULL AND v.price_from < 5')
    else if (price === '5to8') where.push('v.price_from IS NOT NULL AND v.price_from >= 5 AND v.price_from <= 8')
    else if (price === 'over8') where.push('v.price_from IS NOT NULL AND v.price_from > 8')

    // Wheelchair (applied in SQL; open-now is post-filter)
    if (special.includes('wheelchair')) where.push('v.wheelchair_access = true')

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    let orderBy = 'distance ASC NULLS LAST'
    // Expressions, not the avg_rating / review_count aliases: venues has its own
    // review_count column, so the alias is ambiguous in ORDER BY.
    if (sort === 'rating') orderBy = '(CASE WHEN COUNT(r.id) > 0 THEN AVG(r.rating) ELSE v.rating END) DESC NULLS LAST, (CASE WHEN COUNT(r.id) > 0 THEN COUNT(r.id) ELSE COALESCE(v.reviews_count, 0) END) DESC, distance ASC'
    else if (sort === 'price_low') orderBy = 'v.price_from ASC NULLS LAST, distance ASC'
    else if (sort === 'price_high') orderBy = 'v.price_to DESC NULLS LAST, distance ASC'
    else if (sort === 'name') orderBy = 'v.name ASC'
    // Featured (Premium/Bespoke) venues surface first regardless of sort.
    orderBy = `v.featured DESC, ${orderBy}`

    const sql = `
      SELECT v.*,
             -- On-site reviews when a venue has any; otherwise the Google rating and
             -- review count every other page shows (search used to show no rating at all).
             CASE WHEN COUNT(r.id) > 0 THEN AVG(r.rating) ELSE v.rating END as avg_rating,
             CASE WHEN COUNT(r.id) > 0 THEN COUNT(r.id) ELSE COALESCE(v.reviews_count, 0) END as review_count,
             (3959 * acos(
               LEAST(1, GREATEST(-1,
                 cos(radians($1)) * cos(radians(v.lat)) *
                 cos(radians(v.lng) - radians($2)) +
                 sin(radians($1)) * sin(radians(v.lat))
               ))
             )) as distance
      FROM venues v
      LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
      ${whereSql}
      GROUP BY v.id
      HAVING (3959 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians($1)) * cos(radians(v.lat)) *
          cos(radians(v.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(v.lat))
        ))
      )) <= ${radius}
      ORDER BY ${orderBy}
      LIMIT 50
    `

    const result = await client.query(sql, queryParams)

    let venues = result.rows
    if (special.includes('open-now')) {
      const { isOpenNow } = await import('@/lib/utils')
      venues = venues.filter((v) => isOpenNow(v.opening_hours))
    }

    return venues
  } catch (error) {
    console.error('Search error:', error)
    return []
  } finally {
    if (client) client.release()
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q
  const latParam = params.lat
  const lngParam = params.lng
  const radiusParam = params.radius
  const sortParam = params.sort || 'distance'

  // Structured filter params (old-style ?filters=toddler links are folded in)
  const merged = mergeLegacyFilters(new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : []))))
  const age = (merged.get('age') || '').split(',').filter(Boolean)
  const facilities = (merged.get('facilities') || '').split(',').filter(Boolean)
  const price = merged.get('price') || ''
  const special = (merged.get('special') || '').split(',').filter(Boolean)

  const radius = parseRadius(radiusParam)

  let lat: number | null = null
  let lng: number | null = null
  let locationName: string | null = null
  let geocodeError: string | null = null
  let nameMatches: any[] = []
  let placeSuggestions: { name: string; slug: string }[] = []

  if (latParam && lngParam) {
    lat = parseFloat(latParam)
    lng = parseFloat(lngParam)
    locationName = 'Your location'
  } else if (query) {
    if (isValidUKPostcode(query)) {
      const result = await geocodePostcode(query)
      if (result.error) {
        geocodeError = result.error
      } else {
        lat = result.lat
        lng = result.lng
        locationName = formatPostcode(query)
      }
    } else {
      // Not a postcode — this is how a typed city/town name (e.g. from
      // pressing Enter instead of picking the autocomplete suggestion)
      // arrives here. Redirect to the matching city page rather than
      // showing "enter a valid UK postcode" for a name the app itself
      // suggested. Falls through to that message only for genuinely
      // unrecognized input.
      const trimmedQuery = query.trim().toLowerCase()
      const cityMatch = citiesBasic.find((c) => c.name.toLowerCase() === trimmedQuery)
      const townMatch = cityMatch ? null : getStaticTowns().find((t) => t.name.toLowerCase() === trimmedQuery)
      const slug = cityMatch?.slug || townMatch?.slug
      if (slug) {
        redirect(`/soft-play/${slug}`)
      }
      if (isUKOutcode(query)) {
        const result = await geocodeOutcode(query)
        if (result.error) geocodeError = result.error
        else {
          lat = result.lat
          lng = result.lng
          locationName = result.postcode
        }
      } else {
        locationName = query
        nameMatches = await searchVenuesByName(query)
        placeSuggestions = suggestPlaces(query)
      }
    }
  }

  let venues: any[] = []
  if (lat && lng) {
    venues = await searchVenues(lat, lng, radius, age, facilities, price, special, sortParam)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <Breadcrumbs items={[
        { label: 'Search' },
        ...(locationName ? [{ label: locationName }] : []),
      ]} />

      {/* Search form */}
      <div className="bg-gradient-to-b from-purple-600 to-purple-700 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white text-center mb-6">
            {locationName
              ? `Soft Play Centres Near ${locationName}`
              : 'Find Soft Play Centres Near You'}
          </h1>
          <SearchForm
            defaultValue={query || ''}
            defaultRadius={radius}
            className="bg-white rounded-xl p-4 shadow-lg"
          />
        </div>
      </div>

      {/* Main content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {geocodeError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">
              {geocodeError}. Please check the postcode and try again.
            </p>
          </div>
        ) : !lat && !lng && query && nameMatches.length > 0 ? (
          <div className="mb-6">
            {placeSuggestions.length > 0 && (
              <p className="mb-4 text-slate-700">
                Looking for a place?{' '}
                {placeSuggestions.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 && ', '}
                    <Link href={`/soft-play/${p.slug}`} className="font-medium text-purple-700 underline">Soft play in {p.name}</Link>
                  </span>
                ))}
              </p>
            )}
            <h2 className="text-xl font-semibold mb-4">
              {nameMatches.length === 30 ? '30+' : nameMatches.length} {nameMatches.length === 1 ? 'venue' : 'venues'} matching &ldquo;{query.trim()}&rdquo;
            </h2>
            <SearchResults venues={nameMatches} showDistance={false} />
          </div>
        ) : !lat && !lng && query ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-yellow-800">
            <p>
              We couldn&apos;t find a town, postcode or venue matching &ldquo;{query.trim()}&rdquo;.
              Try a full postcode (HU5 3AB), a postcode district (HU5) or a town name.
            </p>
            {placeSuggestions.length > 0 && (
              <p className="mt-2">
                Did you mean:{' '}
                {placeSuggestions.map((p, i) => (
                  <span key={p.slug}>
                    {i > 0 && ', '}
                    <Link href={`/soft-play/${p.slug}`} className="font-medium underline">{p.name}</Link>
                  </span>
                ))}
              </p>
            )}
            <p className="mt-2">
              Or <Link href="/soft-play" className="font-medium underline">browse every town and city</Link>.
            </p>
          </div>
        ) : null}

        {(lat && lng) || venues.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar — sticky on desktop, collapsible bar on mobile (order-1 = top on mobile) */}
            <aside className="lg:col-span-1 order-1">
              {/* One filter component, laid out responsively (sticky bar on mobile, panel on desktop) */}
              <SearchFilters hasLocation={!!(lat && lng)} />
            </aside>

            <div className="lg:col-span-3 order-2">
              {/* Active filter chips */}
              <ActiveFilterBar className="mb-4" />
              <SearchResults
                venues={venues}
                showDistance={!!(lat && lng)}
              />
            </div>
          </div>
        ) : !query ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">
              Enter a postcode to find soft play centres near you
            </h2>
            <p className="text-slate-500">
              Or use your current location for automatic search
            </p>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  )
}
