import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCityBySlug, getAllCitySlugs, getNearbyCities, filters } from '@/lib/venues'
import { MapPin, Star, Coffee, Car, Baby, PartyPopper, Heart, Phone, Globe, Navigation } from 'lucide-react'
import type { Metadata } from 'next'
import { getPool } from '@/lib/pool'
import { getStaticVenuesByTown, getStaticTownBySlug, getAllStaticTownSlugs, type StaticVenue } from '@/lib/staticVenues'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

interface PageProps {
  params: Promise<{ city: string }>
  searchParams: Promise<{ filter?: string; search?: string }>
}

export async function generateStaticParams() {
  const dbSlugs = getAllCitySlugs()
  const staticSlugs = getAllStaticTownSlugs()
  const allSlugs = [...new Set([...dbSlugs, ...staticSlugs])]
  return allSlugs.map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const cityConfig = getCityBySlug(city)

  if (!cityConfig) {
    const staticTown = getStaticTownBySlug(city)
    if (!staticTown) {
      return { title: 'City Not Found | Soft Play Near Me' }
    }

    const title = `Soft Play Near ${staticTown.name} | Indoor Play Centres & Kids Activities`
    const description = `Find the best soft play centres near ${staticTown.name}. Browse local indoor play venues, check facilities, opening times, and plan your visit.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `https://www.softplaynearme.co.uk/soft-play/${city}`,
        type: 'website',
        siteName: 'Soft Play Near Me',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
      alternates: {
        canonical: `https://www.softplaynearme.co.uk/soft-play/${city}`,
      },
    }
  }

  return {
    title: cityConfig.metaTitle,
    description: cityConfig.metaDescription,
    openGraph: {
      title: cityConfig.metaTitle,
      description: cityConfig.metaDescription,
      url: `https://www.softplaynearme.co.uk/soft-play/${city}`,
      type: 'website',
      siteName: 'Soft Play Near Me',
    },
    twitter: {
      card: 'summary_large_image',
      title: cityConfig.metaTitle,
      description: cityConfig.metaDescription,
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
  phone?: string
  website?: string
  description?: string
  cafe?: boolean
  parking?: boolean
  parties?: boolean
  toddler_area?: boolean
  baby_area?: boolean
  sen_friendly?: boolean
  avg_rating?: number
  review_count?: number
  mapsUrl?: string
  notes?: string
  isStatic?: boolean
}

function staticToDisplayVenue(sv: StaticVenue): Venue {
  return {
    name: sv.name,
    slug: sv.slug,
    address: sv.address,
    postcode: sv.postcode,
    phone: sv.phone || undefined,
    website: sv.website || undefined,
    description: sv.notes || undefined,
    mapsUrl: sv.mapsUrl || undefined,
    cafe: false,
    parking: false,
    parties: false,
    toddler_area: false,
    baby_area: false,
    sen_friendly: false,
    isStatic: true
  }
}

async function getVenues(citySlug: string, filter?: string, search?: string): Promise<Venue[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()

    try {
      let query = `
        SELECT v.*,
               COALESCE(AVG(r.rating), 0) as avg_rating,
               COUNT(r.id) as review_count
        FROM venues v
        LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
        WHERE v.city_slug = $1
      `
      const params: (string | boolean)[] = [citySlug]

      if (filter) {
        if (filter === 'cafe') query += ` AND v.cafe = true`
        else if (filter === 'parking') query += ` AND v.parking = true`
        else if (filter === 'parties') query += ` AND v.parties = true`
        else if (filter === 'toddler') query += ` AND v.toddler_area = true`
        else if (filter === 'sen') query += ` AND v.sen_friendly = true`
      }

      if (search) {
        params.push(`%${search}%`)
        query += ` AND (v.name ILIKE $${params.length} OR v.description ILIKE $${params.length})`
      }

      query += ` GROUP BY v.id ORDER BY avg_rating DESC, review_count DESC, v.name ASC`

      const result = await client.query(query, params)
      if (result.rows.length > 0) {
        return result.rows
      }
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Database unavailable, falling back to static data:', error)
  }

  const staticVenues = getStaticVenuesByTown(citySlug)
  let venues = staticVenues.map(staticToDisplayVenue)

  if (search) {
    const searchLower = search.toLowerCase()
    venues = venues.filter(v =>
      v.name.toLowerCase().includes(searchLower) ||
      (v.description && v.description.toLowerCase().includes(searchLower))
    )
  }

  return venues
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city } = await params
  const { filter, search } = await searchParams
  const cityConfig = getCityBySlug(city)
  const staticTown = getStaticTownBySlug(city)

  if (!cityConfig && !staticTown) {
    notFound()
  }

  const displayName = cityConfig?.name || staticTown?.name || city
  const county = cityConfig?.county || ''
  const h1 = cityConfig?.h1 || `Soft Play in ${displayName}`
  const intro = cityConfig?.intro || `Discover soft play centres in ${displayName}. Browse venues, check facilities, and find the perfect place for your family.`
  const faqs = cityConfig?.faqs || []
  const nearbyAreas = cityConfig?.nearbyAreas || []

  const venues = await getVenues(city, filter, search)
  const nearbyCities = cityConfig ? getNearbyCities(city) : []

  // Breadcrumb schema
  const breadcrumbItems = [
    ...(county ? [{ '@type': 'ListItem' as const, position: 2, name: county }] : []),
    {
      '@type': 'ListItem' as const,
      position: county ? 3 : 2,
      name: `Soft Play in ${displayName}`,
      item: `https://www.softplaynearme.co.uk/soft-play/${city}`,
    },
  ]

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
      ...breadcrumbItems,
    ],
  }

  const faqSchema = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  } : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

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
            <p className="text-purple-100 text-lg max-w-3xl">{intro}</p>
          </div>
        </div>

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
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-slate-700">
              {venues.length} {venues.length === 1 ? 'venue' : 'venues'} found
            </h2>
          </div>

          {/* Venues Grid */}
          {venues.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No venues found yet</h3>
              <p className="text-slate-500 mb-6">We're still building our directory for {displayName}.</p>
              <Link href="/add-venue">
                <Button className="bg-purple-600 hover:bg-purple-700">Add a Venue</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map((venue) => (
                <Card key={venue.slug} className="group hover:shadow-lg transition-all duration-200 border-slate-200 overflow-hidden h-full flex flex-col">
                  <div className="p-5 flex-1">
                    {/* Header row: name + rating */}
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <Link href={`/soft-play/${city}/${venue.slug}`} className="hover:text-purple-600 transition-colors min-w-0">
                        <h3 className="text-lg font-bold leading-tight line-clamp-2">
                          {venue.name}
                        </h3>
                      </Link>
                      {venue.review_count && venue.review_count > 0 ? (
                        <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded text-purple-700 font-bold text-sm flex-shrink-0">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          {Number(venue.avg_rating || 0).toFixed(1)}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="flex-shrink-0">New</Badge>
                      )}
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{venue.address || venue.postcode}</span>
                    </div>

                    {/* Description */}
                    {venue.description && (
                      <p className="text-slate-600 text-sm mb-3 line-clamp-2">{venue.description}</p>
                    )}

                    {/* Feature badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {venue.toddler_area && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Baby className="w-3 h-3" /> Toddler
                        </Badge>
                      )}
                      {venue.parties && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <PartyPopper className="w-3 h-3" /> Parties
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
                      {venue.sen_friendly && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Heart className="w-3 h-3" /> SEN
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* CTA footer */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <Button asChild className="flex-1 bg-purple-600 hover:bg-purple-700" size="sm">
                      <Link href={`/soft-play/${city}/${venue.slug}`}>
                        View Details
                      </Link>
                    </Button>
                    {(venue.mapsUrl || venue.address) && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={venue.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.address}, ${venue.postcode}`)}`}
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
              ))}
            </div>
          )}

          {/* Nearby Areas */}
          {(nearbyCities.length > 0 || nearbyAreas.length > 0) && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-4">Nearby Areas</h2>
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
            </div>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                    <p className="text-slate-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <Footer minimal />
      </div>
    </>
  )
}
