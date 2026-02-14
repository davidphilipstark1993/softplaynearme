import { Metadata } from 'next'
import Link from 'next/link'
import { getPool } from '@/lib/pool'
import { geocodePostcode, parseRadius, formatPostcode, isValidUKPostcode } from '@/lib/geo'
import { SearchForm } from '@/components/search/SearchForm'
import { SearchResults } from '@/components/search/SearchResults'
import { SearchFilters } from './SearchFilters'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    lat?: string
    lng?: string
    radius?: string
    filters?: string
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

  const title = 'Search Soft Play Centres | Soft Play Near Me'
  const description = 'Search for soft play centres near you. Filter by facilities, distance, and more to find the perfect venue for your family.'
  return {
    title,
    description,
    openGraph: { title, description, url: 'https://www.softplaynearme.co.uk/search', type: 'website', siteName: 'Soft Play Near Me' },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: 'https://www.softplaynearme.co.uk/search' },
  }
}

async function searchVenues(
  lat: number,
  lng: number,
  radius: number,
  filters: string[],
  sort: string
) {
  let client
  try {
    client = await getPool().connect()

    const params: (number | string)[] = [lat, lng]
    const where: string[] = []

    const latDegPerMile = 1 / 69.0
    const lngDegPerMile = 1 / (69.0 * Math.cos((lat * Math.PI) / 180))
    const minLat = lat - radius * latDegPerMile
    const maxLat = lat + radius * latDegPerMile
    const minLng = lng - radius * lngDegPerMile
    const maxLng = lng + radius * lngDegPerMile

    where.push(`v.lat BETWEEN ${minLat} AND ${maxLat}`)
    where.push(`v.lng BETWEEN ${minLng} AND ${maxLng}`)

    for (const f of filters) {
      if (f === 'toddler') where.push('v.toddler_area = true')
      else if (f === 'parties') where.push('v.parties = true')
      else if (f === 'sen') where.push('v.sen_friendly = true')
      else if (f === 'cafe') where.push('v.cafe = true')
      else if (f === 'parking') where.push('v.parking = true')
      else if (f === 'wheelchair') where.push('v.wheelchair_access = true')
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    let orderBy = 'distance ASC NULLS LAST'
    if (sort === 'rating') {
      orderBy = 'avg_rating DESC, review_count DESC, distance ASC'
    } else if (sort === 'price_low') {
      orderBy = 'v.price_from ASC NULLS LAST, distance ASC'
    } else if (sort === 'price_high') {
      orderBy = 'v.price_to DESC NULLS LAST, distance ASC'
    }

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

    const result = await client.query(sql, params)

    let venues = result.rows
    if (filters.includes('open_now')) {
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
  const filtersParam = params.filters
  const sortParam = params.sort || 'distance'

  const radius = parseRadius(radiusParam)
  const filters = filtersParam?.split(',').filter(Boolean) || []

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
      locationName = query
    }
  }

  let venues: any[] = []
  if (lat && lng) {
    venues = await searchVenues(lat, lng, radius, filters, sortParam)
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
            <aside className="lg:col-span-1">
              <div className="lg:sticky lg:top-24">
                <SearchFilters
                  selectedFilters={filters}
                  selectedSort={sortParam}
                  hasLocation={!!(lat && lng)}
                />
              </div>
            </aside>

            <div className="lg:col-span-3">
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
