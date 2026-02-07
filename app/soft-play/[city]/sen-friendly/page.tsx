import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCityBySlug, getAllCitySlugs, getFilterBySlug } from '@/lib/venues'
import { MapPin, Star, Coffee, Baby, Heart } from 'lucide-react'
import type { Metadata } from 'next'
import { getPool } from '@/lib/pool'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

interface PageProps {
  params: Promise<{ city: string }>
}

const FILTER_SLUG = 'sen-friendly'

export async function generateStaticParams() {
  return getAllCitySlugs().map((city) => ({ city }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const cityConfig = getCityBySlug(city)
  const filterConfig = getFilterBySlug(FILTER_SLUG)

  if (!cityConfig || !filterConfig) return { title: 'Not Found | Soft Play Near Me' }

  const title = filterConfig.metaTitleTemplate.replace('{city}', cityConfig.name)
  const description = filterConfig.metaDescriptionTemplate.replace('{city}', cityConfig.name)

  return {
    title, description,
    openGraph: { title, description, url: `https://www.softplaynearme.co.uk/soft-play/${city}/${FILTER_SLUG}`, type: 'website', siteName: 'Soft Play Near Me' },
    alternates: { canonical: `https://www.softplaynearme.co.uk/soft-play/${city}/${FILTER_SLUG}` },
  }
}

interface Venue {
  id: number; name: string; slug: string; postcode: string; description?: string
  cafe: boolean; parking: boolean; parties: boolean; toddler_area: boolean; sen_friendly: boolean
  avg_rating?: number; review_count?: number
}

async function getVenues(citySlug: string): Promise<Venue[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT v.*, COALESCE(AVG(r.rating), 0) as avg_rating, COUNT(r.id) as review_count
        FROM venues v LEFT JOIN reviews r ON r.venue_id = v.id AND r.approved = true
        WHERE v.city_slug = $1 AND v.sen_friendly = true
        GROUP BY v.id ORDER BY avg_rating DESC, review_count DESC, v.name ASC
      `, [citySlug])
      return result.rows
    } finally { client.release() }
  } catch (error) { console.error('Error:', error); return [] }
}

export default async function SENFriendlyPage({ params }: PageProps) {
  const { city } = await params
  const cityConfig = getCityBySlug(city)
  const filterConfig = getFilterBySlug(FILTER_SLUG)

  if (!cityConfig || !filterConfig) notFound()

  const venues = await getVenues(city)
  const h1 = filterConfig.h1Template.replace('{city}', cityConfig.name)
  const intro = filterConfig.introTemplate.replace('{city}', cityConfig.name)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: cityConfig.name, href: '/soft-play/' + city }, { label: filterConfig.name }]} />

      <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{h1}</h1>
          <p className="text-purple-100 text-lg max-w-3xl">{intro}</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{venues.length} {venues.length === 1 ? 'venue' : 'venues'} found</h2>
          <Link href={`/soft-play/${city}`}><Button variant="outline">View All Venues</Button></Link>
        </div>

        {venues.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-slate-400 text-6xl mb-4">💚</div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No SEN-friendly venues found yet</h3>
            <Link href={`/soft-play/${city}`}><Button className="bg-purple-600 hover:bg-purple-700">View All Venues</Button></Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venues.map((venue) => (
              <Link key={venue.id} href={`/soft-play/${city}/${venue.slug}`}>
                <Card className="group hover:shadow-xl transition-all h-full">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-xl font-bold group-hover:text-purple-600">{venue.name}</h3>
                      {venue.review_count && venue.review_count > 0 ? (
                        <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded text-purple-700 font-bold text-sm">
                          <Star className="w-3.5 h-3.5 fill-current" />{Number(venue.avg_rating || 0).toFixed(1)}
                        </div>
                      ) : <Badge variant="secondary">New</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                      <MapPin className="w-4 h-4 text-slate-400" />{venue.postcode}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs bg-green-50"><Heart className="w-3 h-3 mr-1" /> SEN Friendly</Badge>
                      {venue.cafe && <Badge variant="outline" className="text-xs"><Coffee className="w-3 h-3 mr-1" /> Cafe</Badge>}
                      {venue.toddler_area && <Badge variant="outline" className="text-xs"><Baby className="w-3 h-3 mr-1" /> Toddler Area</Badge>}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border-t"><Button className="w-full bg-purple-600 hover:bg-purple-700">View Details</Button></div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer minimal />
    </div>
  )
}
