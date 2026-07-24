import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MapPin,
  Star,
  Coffee,
  Car,
  Cake,
  Baby,
  Heart,
  Accessibility,
  Navigation,
} from 'lucide-react'
import { formatDistance } from '@/lib/geo'
import { getCardQuote, formatLastVerified } from '@/lib/venueCardText'
import { cn } from '@/lib/utils'

interface VenueResult {
  id: number
  name: string
  slug: string
  city_slug: string
  address: string
  postcode: string
  description: string | null
  review_snippet?: string | null
  last_verified_at?: string | null
  price_from: number | null
  price_to: number | null
  price_range: string | null
  cafe: boolean
  parking: boolean
  parties: boolean
  toddler_area: boolean
  sen_friendly: boolean
  wheelchair_access: boolean
  avg_rating: number | null
  review_count: number
  distance?: number
  main_image_url?: string | null
}

interface SearchResultsProps {
  venues: VenueResult[]
  isLoading?: boolean
  showDistance?: boolean
  className?: string
}

const FEATURE_BADGES = [
  { key: 'toddler_area', label: 'Toddler', icon: Baby },
  { key: 'parties', label: 'Parties', icon: Cake },
  { key: 'cafe', label: 'Cafe', icon: Coffee },
  { key: 'parking', label: 'Parking', icon: Car },
  { key: 'sen_friendly', label: 'SEN', icon: Heart },
  { key: 'wheelchair_access', label: 'Accessible', icon: Accessibility },
]

function VenueCard({
  venue,
  showDistance,
}: {
  venue: VenueResult
  showDistance: boolean
}) {
  const activeFeatures = FEATURE_BADGES.filter(
    (f) => venue[f.key as keyof VenueResult]
  ).slice(0, 4)

  const priceDisplay =
    venue.price_from && venue.price_to
      ? `£${Number(venue.price_from).toFixed(0)} - £${Number(venue.price_to).toFixed(0)}`
      : venue.price_from
        ? `From £${Number(venue.price_from).toFixed(0)}`
        : venue.price_range || null

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="relative h-28 w-full overflow-hidden rounded-lg bg-slate-100 sm:h-24 sm:w-36 sm:flex-shrink-0">
            {venue.main_image_url ? (
              <Image
                src={venue.main_image_url}
                alt={`${venue.name} soft play venue`}
                fill
                loading="lazy"
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 144px"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-pink-100" />
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <Link
                href={`/soft-play/${venue.city_slug}/${venue.slug}`}
                className="hover:text-purple-600 transition-colors"
              >
                <h3 className="font-semibold text-lg leading-tight">{venue.name}</h3>
              </Link>
              {venue.avg_rating && (
                <div className="flex items-center gap-1 text-sm flex-shrink-0">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{Number(venue.avg_rating).toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    ({venue.review_count})
                  </span>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{venue.postcode}</span>
              {showDistance && venue.distance !== undefined && (
                <Badge variant="secondary" className="ml-auto">
                  {formatDistance(venue.distance)}
                </Badge>
              )}
            </div>

            {/* Genuine review quote only — never the generic AI description */}
            {getCardQuote(venue.review_snippet) && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3 italic">
                &ldquo;{getCardQuote(venue.review_snippet)}&rdquo;
              </p>
            )}

            {/* Features */}
            <div className="flex flex-wrap gap-1.5">
              {activeFeatures.map((feature) => {
                const Icon = feature.icon
                return (
                  <span
                    key={feature.key}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs font-medium"
                  >
                    <Icon className="h-3 w-3" />
                    {feature.label}
                  </span>
                )
              })}
            </div>

            {formatLastVerified(venue.last_verified_at) && (
              <p className="text-xs text-muted-foreground mt-2">
                Verified {formatLastVerified(venue.last_verified_at)}
              </p>
            )}
          </div>

          {/* Right side - Price and CTA */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:gap-3 sm:ml-4">
            {priceDisplay && (
              <div className="text-right">
                <p className="text-lg font-bold text-purple-600">{priceDisplay}</p>
                <p className="text-xs text-muted-foreground">per child</p>
              </div>
            )}
            <div className="flex gap-2">
              {showDistance && venue.distance !== undefined && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.address}, ${venue.postcode}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button size="sm" asChild>
                <Link href={`/soft-play/${venue.city_slug}/${venue.slug}`}>
                  View Details
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Loading skeleton
function VenueCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="animate-pulse space-y-3">
          <div className="flex justify-between">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-5 bg-muted rounded w-16" />
          </div>
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="flex gap-2">
            <div className="h-6 bg-muted rounded w-16" />
            <div className="h-6 bg-muted rounded w-16" />
            <div className="h-6 bg-muted rounded w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// No results state
function NoResults({ searchTerm }: { searchTerm?: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No venues found</h3>
        <p className="text-muted-foreground mb-4">
          {searchTerm
            ? `We couldn't find any soft play venues near "${searchTerm}".`
            : "We couldn't find any soft play venues matching your search."}
        </p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters, increasing the search radius, or searching a different location.
        </p>
      </CardContent>
    </Card>
  )
}

export function SearchResults({
  venues,
  isLoading = false,
  showDistance = false,
  className,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(3)].map((_, i) => (
          <VenueCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (venues.length === 0) {
    return <NoResults />
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Quick map context */}
      {venues[0] && (
        <Card>
          <CardContent className="p-3">
            <div className="aspect-[16/6] w-full overflow-hidden rounded-lg border border-slate-200">
              <iframe
                title="Search results map"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  `${venues[0].address || ''}, ${venues[0].postcode || ''}`
                )}&z=11&output=embed`}
                width="100%"
                height="100%"
                loading="lazy"
                style={{ border: 0 }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {venues.length} venue{venues.length !== 1 ? 's' : ''} found
      </p>

      {/* Venue list */}
      {venues.map((venue) => (
        <VenueCard key={venue.id} venue={venue} showDistance={showDistance} />
      ))}
    </div>
  )
}
