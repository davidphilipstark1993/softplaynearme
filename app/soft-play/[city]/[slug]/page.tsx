import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCityBySlug } from '@/lib/venues'
import {
  MapPin,
  Star,
  ChevronRight,
  Home,
} from 'lucide-react'
import type { Metadata } from 'next'
import { getPool } from '@/lib/pool'

// Import new venue components
import { PhotoGallery } from '@/components/venue/PhotoGallery'
import { PricingTable } from '@/components/venue/PricingTable'
import { OpeningHours } from '@/components/venue/OpeningHours'
import { VenueMap } from '@/components/venue/VenueMap'
import { FacilitiesGrid, FacilitiesBadges } from '@/components/venue/FacilitiesGrid'
import { SpecialSessions } from '@/components/venue/SpecialSessions'
import { CTAButtons } from '@/components/venue/CTAButtons'

interface PageProps {
  params: Promise<{ city: string; slug: string }>
}

interface Venue {
  id: number
  name: string
  slug: string
  city_slug: string
  address: string
  postcode: string
  lat?: number
  lng?: number
  phone?: string
  website?: string
  booking_url?: string
  description?: string
  opening_hours?: Record<string, string>
  price_range?: string
  price_from?: number
  price_to?: number
  facilities?: Record<string, boolean>
  google_place_id?: string
  featured?: boolean
  cafe: boolean
  parking: boolean
  parties: boolean
  toddler_area: boolean
  baby_area: boolean
  sen_friendly: boolean
  wheelchair_access: boolean
  free_wifi: boolean
  age_ranges?: string[]
  images?: string[]
  last_verified_at?: string
}

interface Review {
  id: number
  reviewer_name: string
  rating: number
  comment: string
  created_at: string
}

interface PricingItem {
  id: number
  price_type: string
  age_group: string
  price: number
  duration_minutes: number
  notes: string
}

interface Session {
  id: number
  session_type: string
  day_of_week: number
  start_time: string
  end_time: string
  description: string
  booking_required: boolean
}

interface Photo {
  id: number
  url: string
  alt_text: string
  is_primary: boolean
}

async function getVenue(citySlug: string, slug: string): Promise<Venue | null> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venues WHERE city_slug = $1 AND slug = $2',
        [citySlug, slug]
      )
      return result.rows[0] || null
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching venue:', error)
    return null
  }
}

async function getReviews(venueId: number): Promise<Review[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM reviews WHERE venue_id = $1 AND approved = true ORDER BY created_at DESC',
        [venueId]
      )
      return result.rows
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return []
  }
}

async function getPricing(venueId: number): Promise<PricingItem[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venue_pricing WHERE venue_id = $1 ORDER BY price_type, age_group',
        [venueId]
      )
      return result.rows
    } catch (error) {
      // Table might not exist yet
      return []
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching pricing:', error)
    return []
  }
}

async function getSessions(venueId: number): Promise<Session[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venue_sessions WHERE venue_id = $1 ORDER BY session_type, day_of_week',
        [venueId]
      )
      return result.rows
    } catch (error) {
      // Table might not exist yet
      return []
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
}

async function getPhotos(venueId: number): Promise<Photo[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venue_photos WHERE venue_id = $1 ORDER BY is_primary DESC, display_order ASC',
        [venueId]
      )
      return result.rows
    } catch (error) {
      // Table might not exist yet
      return []
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching photos:', error)
    return []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, slug } = await params
  const venue = await getVenue(city, slug)
  const cityConfig = getCityBySlug(city)

  if (!venue || !cityConfig) {
    return { title: 'Venue Not Found | Soft Play Near Me' }
  }

  const title = `${venue.name} | Soft Play in ${cityConfig.name}`
  const description = venue.description || `Visit ${venue.name} soft play centre in ${cityConfig.name}. Check opening times, facilities, and reviews.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`,
      type: 'website',
      siteName: 'Soft Play Near Me',
    },
    alternates: {
      canonical: `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`,
    },
  }
}

export default async function VenuePage({ params }: PageProps) {
  const { city, slug } = await params
  const venue = await getVenue(city, slug)
  const cityConfig = getCityBySlug(city)

  if (!venue || !cityConfig) {
    notFound()
  }

  // Fetch all related data in parallel
  const [reviews, pricing, sessions, photos] = await Promise.all([
    getReviews(venue.id),
    getPricing(venue.id),
    getSessions(venue.id),
    getPhotos(venue.id),
  ])

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0

  // LocalBusiness schema
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: venue.name,
    description: venue.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: cityConfig.name,
      postalCode: venue.postcode,
      addressCountry: 'GB',
    },
    ...(venue.phone && { telephone: venue.phone }),
    ...(venue.website && { url: venue.website }),
    ...(venue.lat && venue.lng && {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: venue.lat,
        longitude: venue.lng,
      },
    }),
    ...(reviews.length > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating.toFixed(1),
        reviewCount: reviews.length,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(venue.price_from && {
      priceRange: venue.price_to
        ? `£${venue.price_from} - £${venue.price_to}`
        : `From £${venue.price_from}`,
    }),
  }

  // Breadcrumb schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.softplaynearme.co.uk',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `Soft Play in ${cityConfig.name}`,
        item: `https://www.softplaynearme.co.uk/soft-play/${city}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: venue.name,
        item: `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-slate-50">
        {/* Navbar */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-bold text-xl text-purple-600">Soft Play Near Me</span>
            </Link>
            <div className="flex gap-4">
              <Link href={`/soft-play/${city}`}>
                <Button variant="ghost">Back to {cityConfig.name}</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Breadcrumbs */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <nav className="flex items-center gap-2 text-sm text-slate-600">
              <Link href="/" className="hover:text-purple-600 flex items-center gap-1">
                <Home className="w-4 h-4" />
                Home
              </Link>
              <ChevronRight className="w-4 h-4" />
              <Link href={`/soft-play/${city}`} className="hover:text-purple-600">
                {cityConfig.name}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-900 truncate">{venue.name}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section with primary photo */}
        <div className="bg-gradient-to-b from-purple-600 to-purple-700 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-2">
                  {venue.featured && (
                    <Badge className="bg-yellow-400 text-yellow-900">Featured</Badge>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold mb-2">{venue.name}</h1>
                <div className="flex items-center gap-2 text-purple-100">
                  <MapPin className="w-5 h-5" />
                  <span>{venue.address}, {venue.postcode}</span>
                </div>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(avgRating)
                              ? 'text-yellow-400 fill-current'
                              : 'text-purple-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold">{avgRating.toFixed(1)}</span>
                    <span className="text-purple-200">({reviews.length} reviews)</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <CTAButtons
                  name={venue.name}
                  address={venue.address}
                  postcode={venue.postcode}
                  lat={venue.lat}
                  lng={venue.lng}
                  phone={venue.phone}
                  website={venue.website}
                  bookingUrl={venue.booking_url}
                  googlePlaceId={venue.google_place_id}
                  compact
                />
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-10">
            <PhotoGallery photos={photos} venueName={venue.name} />
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick features */}
              <FacilitiesBadges
                facilities={venue.facilities}
                cafe={venue.cafe}
                parking={venue.parking}
                parties={venue.parties}
                toddlerArea={venue.toddler_area}
                senFriendly={venue.sen_friendly}
                wheelchairAccess={venue.wheelchair_access}
              />

              {/* About */}
              {venue.description && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-3">About {venue.name}</h2>
                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {venue.description}
                  </p>
                </div>
              )}

              {/* Facilities Grid */}
              <FacilitiesGrid
                facilities={venue.facilities}
                cafe={venue.cafe}
                parking={venue.parking}
                parties={venue.parties}
                toddlerArea={venue.toddler_area}
                babyArea={venue.baby_area}
                senFriendly={venue.sen_friendly}
                wheelchairAccess={venue.wheelchair_access}
                freeWifi={venue.free_wifi}
              />

              {/* Special Sessions */}
              {sessions.length > 0 && <SpecialSessions sessions={sessions} />}

              {/* Reviews Section */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="font-semibold text-lg mb-4">
                  Reviews {reviews.length > 0 && `(${reviews.length})`}
                </h2>
                {reviews.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">
                    No reviews yet. Be the first to review!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border-b border-slate-100 pb-4 last:border-0"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">{review.reviewer_name}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < review.rating
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-600 text-sm">{review.comment}</p>
                        <p className="text-slate-400 text-xs mt-2">
                          {new Date(review.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Sticky sidebar wrapper */}
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Map */}
                <VenueMap
                  name={venue.name}
                  address={venue.address}
                  postcode={venue.postcode}
                  lat={venue.lat ?? null}
                  lng={venue.lng ?? null}
                  googlePlaceId={venue.google_place_id}
                />

                {/* CTA Buttons (full version for sidebar) */}
                <CTAButtons
                  name={venue.name}
                  address={venue.address}
                  postcode={venue.postcode}
                  lat={venue.lat}
                  lng={venue.lng}
                  phone={venue.phone}
                  website={venue.website}
                  bookingUrl={venue.booking_url}
                  googlePlaceId={venue.google_place_id}
                />

                {/* Pricing */}
                <PricingTable
                  pricing={pricing}
                  priceFrom={venue.price_from}
                  priceTo={venue.price_to}
                />

                {/* Opening Hours */}
                <OpeningHours hours={venue.opening_hours ?? null} />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-400 py-8 px-4 mt-12">
          <div className="max-w-7xl mx-auto text-center">
            <p>&copy; {new Date().getFullYear()} Soft Play Near Me. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  )
}
