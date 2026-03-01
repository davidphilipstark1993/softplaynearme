import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Star, ChevronRight } from 'lucide-react'

interface NearbyVenue {
  id: number
  name: string
  slug: string
  city_slug: string
  postcode?: string
  distance?: number
  avg_rating?: number | null
  review_count?: number
  toddler_area?: boolean
  parties?: boolean
  cafe?: boolean
}

interface NearbyVenuesProps {
  venues: NearbyVenue[]
  currentVenueId: number
  cityName: string
  citySlug: string
}

function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${Math.round(miles * 1760)} yards`
  }
  return `${miles.toFixed(1)} mi`
}

export function NearbyVenues({
  venues,
  currentVenueId,
  cityName,
  citySlug,
}: NearbyVenuesProps) {
  // Filter out current venue and limit to 4
  const nearbyVenues = venues
    .filter((v) => v.id !== currentVenueId)
    .slice(0, 4)

  if (nearbyVenues.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Nearby Soft Play Centres</h2>
        <Link
          href={`/soft-play/${citySlug}`}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
        >
          View all in {cityName}
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {nearbyVenues.map((venue) => (
          <Link
            key={venue.id}
            href={`/soft-play/${venue.city_slug}/${venue.slug}`}
            className="block"
          >
            <Card className="p-4 hover:shadow-md hover:border-purple-200 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 group-hover:text-purple-600 transition-colors truncate">
                    {venue.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{venue.postcode}</span>
                    {venue.distance !== undefined && (
                      <span className="text-slate-400">
                        • {formatDistance(venue.distance)}
                      </span>
                    )}
                  </div>
                  {/* Quick badges */}
                  <div className="flex gap-1.5 mt-2">
                    {venue.toddler_area && (
                      <Badge variant="secondary" className="text-xs py-0">
                        Toddler
                      </Badge>
                    )}
                    {venue.parties && (
                      <Badge variant="secondary" className="text-xs py-0">
                        Parties
                      </Badge>
                    )}
                    {venue.cafe && (
                      <Badge variant="secondary" className="text-xs py-0">
                        Cafe
                      </Badge>
                    )}
                  </div>
                </div>
                {venue.avg_rating && venue.avg_rating > 0 && (
                  <div className="flex items-center gap-1 text-sm flex-shrink-0">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="font-medium">{Number(venue.avg_rating).toFixed(1)}</span>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* SEO-friendly link */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-sm text-slate-500">
          Looking for more options?{' '}
          <Link
            href={`/soft-play/${citySlug}`}
            className="text-purple-600 hover:underline font-medium"
          >
            Browse all soft play centres in {cityName}
          </Link>
        </p>
      </div>
    </div>
  )
}
