import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCityBySlug, getAllCitySlugs, getNearbyCities } from '@/lib/venues'
import {
  MapPin,
  Star,
  Navigation,
  Camera,
  Clock,
  Phone,
  CheckCircle2,
} from 'lucide-react'
import type { Metadata } from 'next'
import { getPool } from '@/lib/pool'
import { getStaticVenue, getStaticTownBySlug, getStaticVenuesByTown, getAllStaticTownSlugs, type StaticVenue } from '@/lib/staticVenues'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { buildLocalBusinessSchema, buildBreadcrumbSchema } from '@/lib/schema'
import { JsonLd } from '@/components/seo/JsonLd'
import { getStoredReviews } from '@/lib/reviewsStore'
import { ReviewSection } from '@/components/venue/ReviewSection'

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
  main_image_url?: string
  has_under_1s?: boolean
  has_outdoor_play?: boolean
  has_party_rooms?: boolean
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
      if (result.rows[0]) {
        return result.rows[0]
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Database unavailable, falling back to static data:', error)
  }

  const staticVenue = getStaticVenue(citySlug, slug)
  if (staticVenue) {
    return staticToVenue(staticVenue)
  }

  return null
}

function staticToVenue(sv: StaticVenue): Venue {
  return {
    id: 0,
    name: sv.name,
    slug: sv.slug,
    city_slug: sv.townSlug,
    address: sv.address,
    postcode: sv.postcode,
    lat: sv.lat ?? undefined,
    lng: sv.lng ?? undefined,
    phone: sv.phone || undefined,
    website: sv.website || undefined,
    description: sv.description || sv.notes || undefined,
    rating: sv.rating ?? undefined,
    reviews_count: sv.reviewCount ?? undefined,
    cafe: sv.cafe ?? false,
    parking: sv.parking ?? false,
    parties: sv.parties ?? false,
    toddler_area: sv.toddlerArea ?? false,
    baby_area: sv.babyArea ?? false,
    sen_friendly: sv.senFriendly ?? false,
    wheelchair_access: sv.wheelchairAccess ?? false,
    free_wifi: sv.freeWifi ?? false,
    has_outdoor_play: sv.hasOutdoorPlay ?? false,
    has_party_rooms: sv.hasPartyRooms ?? false,
    has_sen_sessions: sv.hasSenSessions ?? false,
    price_from: sv.priceFrom ?? undefined,
    price_to: sv.priceTo ?? undefined,
    main_image_url: sv.mainImageUrl ?? undefined,
    featured: sv.featured ?? false,
    _mapsUrl: sv.mapsUrl,
    _isStatic: true,
  } as Venue & { _mapsUrl?: string; _isStatic?: boolean }
}

async function getReviews(venueId: number, citySlug: string, venueSlug: string): Promise<Review[]> {
  const storedFallback = async () =>
    (await getStoredReviews({
      venueId: venueId > 0 ? venueId : undefined,
      citySlug,
      venueSlug,
    })) as Review[]

  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM reviews WHERE venue_id = $1 AND approved = true ORDER BY created_at DESC',
        [venueId]
      )
      if (result.rows.length > 0) return result.rows
      return storedFallback()
    } finally {
      client.release()
    }
  } catch {
    return storedFallback()
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
    } catch {
      return []
    } finally {
      client.release()
    }
  } catch {
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
    } catch {
      return []
    } finally {
      client.release()
    }
  } catch {
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
    } catch {
      return []
    } finally {
      client.release()
    }
  } catch {
    return []
  }
}

/** Pre-render venue pages from static data */
export async function generateStaticParams() {
  const params: { city: string; slug: string }[] = []

  // From DB
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query('SELECT city_slug, slug FROM venues')
      for (const row of result.rows) {
        params.push({ city: row.city_slug, slug: row.slug })
      }
    } finally {
      client.release()
    }
  } catch {
    // DB unavailable – use static data below
  }

  // From static JSON (deduplicated)
  const seen = new Set(params.map((p) => `${p.city}/${p.slug}`))
  const allTowns = getAllStaticTownSlugs()
  for (const townSlug of allTowns) {
    const venues = getStaticVenuesByTown(townSlug)
    for (const v of venues) {
      const key = `${townSlug}/${v.slug}`
      if (!seen.has(key)) {
        params.push({ city: townSlug, slug: v.slug })
        seen.add(key)
      }
    }
  }

  return params
}

/** Get nearby venues in the same city (excluding this one) */
async function getNearbyVenues(citySlug: string, excludeSlug: string): Promise<{ name: string; slug: string; postcode: string }[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT name, slug, postcode FROM venues WHERE city_slug = $1 AND slug != $2 ORDER BY name LIMIT 6',
        [citySlug, excludeSlug]
      )
      if (result.rows.length > 0) return result.rows
    } finally {
      client.release()
    }
  } catch {
    // Fall through to static
  }

  const staticVenues = getStaticVenuesByTown(citySlug)
  return staticVenues
    .filter(v => v.slug !== excludeSlug)
    .slice(0, 6)
    .map(v => ({ name: v.name, slug: v.slug, postcode: v.postcode }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, slug } = await params
  const venue = await getVenue(city, slug)
  const cityConfig = getCityBySlug(city)
  const staticTown = getStaticTownBySlug(city)
  const relatedCities = cityConfig ? getNearbyCities(city).slice(0, 6) : []

  if (!venue) {
    return { title: 'Venue Not Found | Soft Play Near Me' }
  }

  const cityName = cityConfig?.name || staticTown?.name || city
  const title = `${venue.name} | Soft Play in ${cityName}`
  const features = [
    venue.toddler_area && 'toddler area',
    venue.parties && 'birthday parties',
    venue.cafe && 'cafe',
    venue.sen_friendly && 'SEN friendly',
  ].filter(Boolean)
  const featureText = features.length > 0 ? ` Features: ${features.join(', ')}.` : ''
  const description = venue.description
    || `Visit ${venue.name} soft play centre in ${cityName}. Check opening times, facilities, prices, and get directions.${featureText}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`,
      type: 'website',
      siteName: 'Soft Play Near Me',
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
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
  const staticTown = getStaticTownBySlug(city)
  const relatedCities = cityConfig ? getNearbyCities(city).slice(0, 6) : []

  if (!venue) {
    notFound()
  }

  const cityName = cityConfig?.name || staticTown?.name || city
  const county = cityConfig?.county || ''
  const isStaticVenue = (venue as any)._isStatic === true

  // Fetch all related data in parallel
  const [reviews, pricing, sessions, photos, nearbyVenues] = await Promise.all([
    getReviews(venue.id, city, slug),
    getPricing(venue.id),
    getSessions(venue.id),
    getPhotos(venue.id),
    getNearbyVenues(city, slug),
  ])

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : ((venue as any).rating ? Number((venue as any).rating) : 0)

  const baseUrl = 'https://www.softplaynearme.co.uk'
  const galleryPhotos = photos.length > 0
    ? photos
    : venue.main_image_url
      ? [{ id: 0, url: venue.main_image_url, alt_text: `${venue.name} soft play area`, is_primary: true }]
      : []

  // LocalBusiness schema – uses reusable builder from lib/schema.ts
  const localBusinessSchema = buildLocalBusinessSchema({
    name: venue.name,
    description: venue.description,
    address: venue.address,
    city: cityName,
    postcode: venue.postcode,
    phone: venue.phone,
    website: venue.website,
    lat: venue.lat,
    lng: venue.lng,
    openingHours: venue.opening_hours,
    priceFrom: venue.price_from,
    priceTo: venue.price_to,
    avgRating: avgRating > 0 ? avgRating : undefined,
    reviewCount: reviews.length > 0 ? reviews.length : ((venue as any).reviews_count || undefined),
    imageUrl: galleryPhotos.length > 0 ? galleryPhotos[0].url : undefined,
    citySlug: city,
    venueSlug: slug,
  })

  // Breadcrumb schema – uses reusable builder
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: `Soft Play in ${cityName}`, url: `${baseUrl}/soft-play/${city}` },
    { name: venue.name, url: `${baseUrl}/soft-play/${city}/${slug}` },
  ])

  const reviewSchema =
    reviews.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: venue.name,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating.toFixed(1),
            reviewCount: reviews.length,
            bestRating: 5,
            worstRating: 1,
          },
          review: reviews.slice(0, 10).map((review) => ({
            '@type': 'Review',
            author: {
              '@type': 'Person',
              name: review.reviewer_name,
            },
            datePublished: review.created_at,
            reviewBody: review.comment,
            reviewRating: {
              '@type': 'Rating',
              ratingValue: review.rating,
              bestRating: 5,
              worstRating: 1,
            },
          })),
        }
      : null

  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={reviewSchema} />

      <div className="min-h-screen bg-slate-50">
        <Header backLink={{ href: `/soft-play/${city}`, label: cityName }} />

        <Breadcrumbs items={[
          ...(county ? [{ label: county }] : []),
          { label: cityName, href: `/soft-play/${city}` },
          { label: venue.name },
        ]} />

        {/* Hero Section */}
        <div className="bg-gradient-to-b from-purple-600 to-purple-700 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="text-white">
                {venue.featured && (
                  <Badge className="bg-yellow-400 text-yellow-900 mb-2">Featured</Badge>
                )}
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                  {venue.name} <span className="text-purple-200 font-normal text-xl sm:text-2xl md:text-3xl">| Soft Play in {cityName}</span>
                </h1>
                <div className="flex items-center gap-2 text-purple-100">
                  <MapPin className="w-5 h-5" />
                  <span>{venue.address}, {venue.postcode}</span>
                </div>
                {avgRating > 0 && (
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
                    <span className="text-purple-200">
                      {reviews.length > 0
                        ? `(${reviews.length} reviews)`
                        : (venue as any).reviews_count
                          ? `(${(venue as any).reviews_count} Google reviews)`
                          : ''}
                    </span>
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

        {/* Photo Gallery / Placeholder */}
        {galleryPhotos.length > 0 ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-10">
            <PhotoGallery photos={galleryPhotos} venueName={venue.name} />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
              <Camera className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h3 className="font-semibold text-slate-700 mb-2">No photos yet</h3>
              <p className="text-sm text-slate-500 mb-4">
                Are you the owner of {venue.name}? Add photos to help families choose your venue.
              </p>
              <Button variant="outline" asChild>
                <a href={`mailto:info@softplaynearme.co.uk?subject=Photos%20for%20${encodeURIComponent(venue.name)}`}>
                  Submit Photos
                </a>
              </Button>
            </div>
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

              {/* Last updated (shown when no description section) */}
              {!venue.description && venue.last_verified_at && (
                <p className="text-xs text-slate-400">
                  Listing last updated: {new Date(venue.last_verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}

              {/* About */}
              {venue.description && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-3">About {venue.name}</h2>
                  <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {venue.description}
                  </p>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-500">
                      Is this information correct?{' '}
                      <a
                        href={`mailto:info@softplaynearme.co.uk?subject=Update%20for%20${encodeURIComponent(venue.name)}`}
                        className="text-purple-600 hover:text-purple-700 underline"
                      >
                        Send us updates
                      </a>
                    </p>
                    {venue.last_verified_at && (
                      <p className="text-xs text-slate-400">
                        Last updated: {new Date(venue.last_verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
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

              <ReviewSection
                initialReviews={reviews}
                venueId={venue.id}
                citySlug={city}
                venueSlug={slug}
              />

              {/* Nearby Venues */}
              {nearbyVenues.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-4">Nearby Soft Play in {cityName}</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {nearbyVenues.map((nv) => (
                      <Link
                        key={nv.slug}
                        href={`/soft-play/${city}/${nv.slug}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{nv.name}</p>
                          <p className="text-xs text-slate-500">{nv.postcode}</p>
                        </div>
                        <Navigation className="w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/soft-play/${city}`}
                    className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium mt-4"
                  >
                    View all venues in {cityName}
                  </Link>
                </div>
              )}

              {relatedCities.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-4">Explore Nearby Cities</h2>
                  <div className="flex flex-wrap gap-2">
                    {relatedCities.map((relatedCity) => (
                      <Link
                        key={relatedCity.slug}
                        href={`/soft-play/${relatedCity.slug}`}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                      >
                        Soft Play in {relatedCity.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Venue Owner Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
                <h2 className="font-semibold text-lg text-green-800 mb-3">
                  Venue Owners: Manage Your Listing
                </h2>
                <p className="text-sm text-green-700 mb-4">
                  Soft Play Near Me helps thousands of parents find venues like yours every month.
                  Claim your free listing to:
                </p>
                <ul className="text-sm text-green-700 space-y-2 mb-4">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Update opening hours and pricing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Add photos and descriptions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Highlight special sessions (SEN, toddler, parties)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Respond to reviews
                  </li>
                </ul>
                <Button asChild className="bg-green-600 hover:bg-green-700">
                  <Link href={`/add-venue?venue=${encodeURIComponent(venue.name)}`}>
                    Claim Your Free Listing
                  </Link>
                </Button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
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
                {venue.opening_hours ? (
                  <OpeningHours hours={venue.opening_hours} />
                ) : (
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5 text-purple-600" />
                        Opening Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-500 mb-3">
                        Opening hours not yet confirmed. Contact the venue directly to check times.
                      </p>
                      {venue.phone && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${venue.phone.replace(/\s/g, '')}`}>
                            <Phone className="h-4 w-4" />
                            Call to Check
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Claim Venue CTA */}
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-green-800">Own this venue?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-green-700">
                      Claim your free listing to update information, add photos,
                      and manage your venue profile.
                    </p>
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                      <Link href={`/add-venue?venue=${encodeURIComponent(venue.name)}`}>
                        Claim This Venue (Free)
                      </Link>
                    </Button>
                    <p className="text-xs text-green-600 text-center">
                      No cost, no obligation
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
