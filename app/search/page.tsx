import { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPool } from '@/lib/pool'
import { geocodePostcode, parseRadius, formatPostcode, isValidUKPostcode } from '@/lib/geo'
import { citiesBasic } from '@/lib/cityBasics'
import { getStaticTowns } from '@/lib/staticTowns'
import { SearchForm } from '@/components/search/SearchForm'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from './SearchFilters'
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
  }>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const params = await searchParams
  const query = params.q

  if (query) {
    const title = `Soft Play Near ${query} | Find Local Indoor Play Centres`
    const description = `Discover the best soft play centres near ${query}. Find venues with cafes, toddler areas, birthday parties, and more.`
    return {
      title,
      description,
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
    openGraph: { title: socialTitle, description, url: 'https://www.softplaynearme.co.uk/search', type: 'website', siteName: 'Soft Play Near Me' },
    twitter: { card: 'summary_large_image', title: socialTitle, description },
    alternates: { canonical: 'https://www.softplaynearme.co.uk/search' },
  }
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
    const where: string[] = []

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
    if (sort === 'rating') orderBy = 'avg_rating DESC, review_count DESC, distance ASC'
    else if (sort === 'price_low') orderBy = 'v.price_from ASC NULLS LAST, distance ASC'
    else if (sort === 'price_high') orderBy = 'v.price_to DESC NULLS LAST, distance ASC'
    else if (sort === 'name') orderBy = 'v.name ASC'
    // Featured (Premium/Bespoke) venues surface first regardless of sort.
    orderBy = `v.featured DESC, ${orderBy}`

    const sql = `
      SELECT v.*,
             COALESCE(AVG(r.rating), 0) as avg_rating,
             COUNT(r.id) as review_count,
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

  // Structured filter params
  const age = (params.age || '').split(',').filter(Boolean)
  const facilities = (params.facilities || '').split(',').filter(Boolean)
  const price = params.price || ''
  const special = (params.special || '').split(',').filter(Boolean)

  const radius = parseRadius(radiusParam)

  let lat: number | null = null
  let lng: number | null = null
  let locationName: string | null = null
  let geocodeError: string | null = null

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
      locationName = query
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {geocodeError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">
              {geocodeError}. Please check the postcode and try again.
            </p>
          </div>
        ) : !lat && !lng && query ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-700">
              Please enter a valid UK postcode to search for venues near you.
            </p>
          </div>
        ) : null}

        {(lat && lng) || venues.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar — sticky on desktop, collapsible bar on mobile (order-1 = top on mobile) */}
            <aside className="lg:col-span-1 order-1">
              {/* Mobile sticky filter bar */}
              <div className="lg:hidden sticky top-16 z-30 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
                <SearchFilters hasLocation={!!(lat && lng)} />
              </div>
              {/* Desktop sidebar */}
              <div className="hidden lg:block sticky top-24">
                <SearchFilters hasLocation={!!(lat && lng)} />
              </div>
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
