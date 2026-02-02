import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCityBySlug } from '@/lib/venues'
import { MapPin, Clock, Star, Coffee, Car, Baby, PartyPopper, Heart, ChevronRight, Phone, Globe, Accessibility, Wifi } from 'lucide-react'
import type { Metadata } from 'next'
import { getPool } from '@/lib/pool'

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
  opening_hours?: Record<string, { open: string; close: string }>
  price_range?: string
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
      type: 'place',
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

  const reviews = await getReviews(venue.id)
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
              <div className="text-2xl">🎈</div>
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
              <Link href="/" className="hover:text-purple-600">Home</Link>
              <ChevronRight className="w-4 h-4" />
              <Link href={`/soft-play/${city}`} className="hover:text-purple-600">
                Soft Play in {cityConfig.name}
              </Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-900 truncate">{venue.name}</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Column */}
            <div className="lg:col-span-2">
              {/* Header */}
              <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
                <div className="flex justify-between items-start mb-4">
                  <h1 className="text-3xl font-bold text-slate-900">{venue.name}</h1>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-1 bg-purple-50 px-3 py-2 rounded-lg">
                      <Star className="w-5 h-5 text-purple-600 fill-current" />
                      <span className="font-bold text-purple-700 text-lg">{avgRating.toFixed(1)}</span>
                      <span className="text-slate-500 text-sm">({reviews.length})</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-slate-600 mb-4">
                  <MapPin className="w-5 h-5 text-slate-400" />
                  <span>{venue.address}, {venue.postcode}</span>
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {venue.toddler_area && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      <Baby className="w-3 h-3 mr-1" /> Toddler Area
                    </Badge>
                  )}
                  {venue.baby_area && (
                    <Badge className="bg-pink-100 text-pink-700 border-pink-200">
                      <Baby className="w-3 h-3 mr-1" /> Baby Area
                    </Badge>
                  )}
                  {venue.parties && (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                      <PartyPopper className="w-3 h-3 mr-1" /> Birthday Parties
                    </Badge>
                  )}
                  {venue.cafe && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      <Coffee className="w-3 h-3 mr-1" /> Cafe
                    </Badge>
                  )}
                  {venue.parking && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      <Car className="w-3 h-3 mr-1" /> Free Parking
                    </Badge>
                  )}
                  {venue.sen_friendly && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      <Heart className="w-3 h-3 mr-1" /> SEN Friendly
                    </Badge>
                  )}
                  {venue.wheelchair_access && (
                    <Badge className="bg-teal-100 text-teal-700 border-teal-200">
                      <Accessibility className="w-3 h-3 mr-1" /> Wheelchair Access
                    </Badge>
                  )}
                  {venue.free_wifi && (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                      <Wifi className="w-3 h-3 mr-1" /> Free WiFi
                    </Badge>
                  )}
                </div>

                {venue.description && (
                  <div>
                    <h2 className="font-semibold text-lg mb-2">About</h2>
                    <p className="text-slate-600 whitespace-pre-wrap">{venue.description}</p>
                  </div>
                )}
              </div>

              {/* Reviews Section */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="font-semibold text-lg mb-4">Reviews</h2>
                {reviews.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No reviews yet. Be the first to review!</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">{review.reviewer_name}</span>
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-slate-200'}`}
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
            <div className="lg:col-span-1">
              {/* Contact Card */}
              <Card className="p-6 mb-6">
                <h3 className="font-semibold text-lg mb-4">Contact & Visit</h3>
                <div className="space-y-3">
                  {venue.phone && (
                    <a
                      href={`tel:${venue.phone}`}
                      className="flex items-center gap-3 text-slate-600 hover:text-purple-600"
                    >
                      <Phone className="w-5 h-5" />
                      {venue.phone}
                    </a>
                  )}
                  {venue.website && (
                    <a
                      href={venue.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-slate-600 hover:text-purple-600"
                    >
                      <Globe className="w-5 h-5" />
                      Visit Website
                    </a>
                  )}
                  <div className="flex items-start gap-3 text-slate-600">
                    <MapPin className="w-5 h-5 mt-0.5" />
                    <div>
                      <p>{venue.address}</p>
                      <p>{venue.postcode}</p>
                    </div>
                  </div>
                </div>

                {venue.booking_url && (
                  <a href={venue.booking_url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
                      Book Now
                    </Button>
                  </a>
                )}

                {venue.lat && venue.lng && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="w-full mt-2">
                      Get Directions
                    </Button>
                  </a>
                )}
              </Card>

              {/* Opening Hours */}
              {venue.opening_hours && (
                <Card className="p-6 mb-6">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Opening Hours
                  </h3>
                  <div className="space-y-2 text-sm">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                      const hours = venue.opening_hours?.[day]
                      const isToday = new Date().toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase() === day
                      return (
                        <div
                          key={day}
                          className={`flex justify-between ${isToday ? 'font-semibold text-purple-600' : 'text-slate-600'}`}
                        >
                          <span className="capitalize">{day}</span>
                          <span>
                            {hours?.open === 'closed' ? 'Closed' : hours ? `${hours.open} - ${hours.close}` : '-'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              {/* Price Range */}
              {venue.price_range && (
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-2">Price Range</h3>
                  <p className="text-slate-600">{venue.price_range}</p>
                </Card>
              )}
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
