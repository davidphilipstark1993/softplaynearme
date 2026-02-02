import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCityBySlug, getAllCitySlugs, getNearbyCities, filters } from '@/lib/venues'
import { MapPin, Clock, Star, Coffee, Car, Baby, PartyPopper, Heart, ChevronRight, Phone, Globe } from 'lucide-react'
import type { Metadata } from 'next'
import { getPool } from '@/lib/pool'

interface PageProps {
  params: Promise<{ city: string }>
  searchParams: Promise<{ filter?: string; search?: string }>
}

export async function generateStaticParams() {
  const slugs = getAllCitySlugs()
  return slugs.map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const cityConfig = getCityBySlug(city)

  if (!cityConfig) {
    return { title: 'City Not Found | Soft Play Near Me' }
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
    alternates: {
      canonical: `https://www.softplaynearme.co.uk/soft-play/${city}`,
    },
  }
}

interface Venue {
  id: number
  name: string
  slug: string
  address: string
  postcode: string
  phone?: string
  website?: string
  description?: string
  cafe: boolean
  parking: boolean
  parties: boolean
  toddler_area: boolean
  baby_area: boolean
  sen_friendly: boolean
  avg_rating?: number
  review_count?: number
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
        if (filter === 'cafe') {
          query += ` AND v.cafe = true`
        } else if (filter === 'parking') {
          query += ` AND v.parking = true`
        } else if (filter === 'parties') {
          query += ` AND v.parties = true`
        } else if (filter === 'toddler') {
          query += ` AND v.toddler_area = true`
        } else if (filter === 'sen') {
          query += ` AND v.sen_friendly = true`
        }
      }

      if (search) {
        params.push(`%${search}%`)
        query += ` AND (v.name ILIKE $${params.length} OR v.description ILIKE $${params.length})`
      }

      query += ` GROUP BY v.id ORDER BY avg_rating DESC, review_count DESC, v.name ASC`

      const result = await client.query(query, params)
      return result.rows
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching venues:', error)
    return []
  }
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city } = await params
  const { filter, search } = await searchParams
  const cityConfig = getCityBySlug(city)

  if (!cityConfig) {
    notFound()
  }

  const venues = await getVenues(city, filter, search)
  const nearbyCities = getNearbyCities(city)

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
    ],
  }

  // FAQ schema
  const faqSchema = cityConfig.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cityConfig.faqs.map((faq) => ({
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
        {/* Navbar */}
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="text-2xl">🎈</div>
              <span className="font-bold text-xl text-purple-600">Soft Play Near Me</span>
            </Link>
            <div className="flex gap-4">
              <Link href={`/soft-play/${city}`}>
                <Button variant="ghost">Find Soft Play</Button>
              </Link>
              <Link href="/add-venue">
                <Button className="bg-purple-600 text-white hover:bg-purple-700">
                  Add Venue
                </Button>
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
              <span className="text-slate-900">Soft Play in {cityConfig.name}</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{cityConfig.h1}</h1>
            <p className="text-purple-100 text-lg max-w-3xl">{cityConfig.intro}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-slate-200 py-4 overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex gap-2 min-w-max">
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

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {venues.length} {venues.length === 1 ? 'venue' : 'venues'} found
            </h2>
          </div>

          {/* Venues Grid */}
          {venues.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-slate-400 text-6xl mb-4">🎈</div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No venues found yet</h3>
              <p className="text-slate-500 mb-6">We're still building our directory for {cityConfig.name}.</p>
              <Link href="/add-venue">
                <Button className="bg-purple-600 hover:bg-purple-700">Add a Venue</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {venues.map((venue) => (
                <Link key={venue.id} href={`/soft-play/${city}/${venue.slug}`}>
                  <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 overflow-hidden h-full">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-xl font-bold group-hover:text-purple-600 transition-colors">
                          {venue.name}
                        </h3>
                        {venue.review_count && venue.review_count > 0 ? (
                          <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded text-purple-700 font-bold text-sm">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            {Number(venue.avg_rating || 0).toFixed(1)}
                          </div>
                        ) : (
                          <Badge variant="secondary">New</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {venue.postcode}
                      </div>

                      {venue.description && (
                        <p className="text-slate-600 text-sm mb-4 line-clamp-2">{venue.description}</p>
                      )}

                      {/* Feature badges */}
                      <div className="flex flex-wrap gap-2">
                        {venue.toddler_area && (
                          <Badge variant="outline" className="text-xs">
                            <Baby className="w-3 h-3 mr-1" /> Toddler Area
                          </Badge>
                        )}
                        {venue.parties && (
                          <Badge variant="outline" className="text-xs">
                            <PartyPopper className="w-3 h-3 mr-1" /> Parties
                          </Badge>
                        )}
                        {venue.cafe && (
                          <Badge variant="outline" className="text-xs">
                            <Coffee className="w-3 h-3 mr-1" /> Cafe
                          </Badge>
                        )}
                        {venue.parking && (
                          <Badge variant="outline" className="text-xs">
                            <Car className="w-3 h-3 mr-1" /> Parking
                          </Badge>
                        )}
                        {venue.sen_friendly && (
                          <Badge variant="outline" className="text-xs">
                            <Heart className="w-3 h-3 mr-1" /> SEN
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <Button className="w-full bg-purple-600 hover:bg-purple-700">
                        View Details
                      </Button>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {/* Nearby Areas */}
          {nearbyCities.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-4">Nearby Areas</h2>
              <div className="flex flex-wrap gap-2">
                {cityConfig.nearbyAreas.map((area) => {
                  const nearbyCity = nearbyCities.find(c => c.name === area)
                  if (nearbyCity) {
                    return (
                      <Link key={area} href={`/soft-play/${nearbyCity.slug}`}>
                        <Badge variant="outline" className="hover:bg-purple-50 cursor-pointer">
                          {area}
                        </Badge>
                      </Link>
                    )
                  }
                  return (
                    <Badge key={area} variant="outline" className="text-slate-400">
                      {area}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          {/* FAQs */}
          {cityConfig.faqs.length > 0 && (
            <div className="mt-12">
              <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {cityConfig.faqs.map((faq, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg border border-slate-200">
                    <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                    <p className="text-slate-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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
