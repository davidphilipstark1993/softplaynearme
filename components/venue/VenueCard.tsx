import Link from 'next/link'
import Image from 'next/image'
import { shimmerDataURL } from '@/lib/imageUtils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MapPin,
  Star,
  Coffee,
  Car,
  Baby,
  PartyPopper,
  Heart,
  Accessibility,
  Navigation,
  Clock,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface VenueCardProps {
  venue: {
    id?: number
    name: string
    slug: string
    city_slug?: string
    citySlug?: string
    address?: string
    postcode?: string
    description?: string
    phone?: string
    website?: string
    cafe?: boolean
    parking?: boolean
    parties?: boolean
    toddler_area?: boolean
    baby_area?: boolean
    sen_friendly?: boolean
    wheelchair_access?: boolean
    avg_rating?: number | null
    review_count?: number
    distance?: number
    price_from?: number
    price_to?: number
    images?: string[]
    isOpen?: boolean
  }
  showDistance?: boolean
  variant?: 'default' | 'compact' | 'horizontal'
  className?: string
}

const FEATURE_CONFIG = [
  { key: 'toddler_area', label: 'Toddler', icon: Baby, color: 'text-blue-600 bg-blue-50' },
  { key: 'parties', label: 'Parties', icon: PartyPopper, color: 'text-pink-600 bg-pink-50' },
  { key: 'cafe', label: 'Cafe', icon: Coffee, color: 'text-amber-600 bg-amber-50' },
  { key: 'parking', label: 'Parking', icon: Car, color: 'text-green-600 bg-green-50' },
  { key: 'sen_friendly', label: 'SEN', icon: Heart, color: 'text-purple-600 bg-purple-50' },
  { key: 'wheelchair_access', label: 'Accessible', icon: Accessibility, color: 'text-teal-600 bg-teal-50' },
] as const

function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${Math.round(miles * 1760)} yards`
  }
  return `${miles.toFixed(1)} mi`
}

function formatPrice(from?: number, to?: number): string | null {
  if (from && to) {
    return `£${from.toFixed(0)}-£${to.toFixed(0)}`
  }
  if (from) {
    return `From £${from.toFixed(0)}`
  }
  return null
}

export function VenueCard({
  venue,
  showDistance = false,
  variant = 'default',
  className,
}: VenueCardProps) {
  const citySlug = venue.city_slug || venue.citySlug || 'unknown'
  const venueUrl = `/soft-play/${citySlug}/${venue.slug}`

  const activeFeatures = FEATURE_CONFIG.filter(
    (f) => venue[f.key as keyof typeof venue]
  ).slice(0, 4)

  const priceDisplay = formatPrice(venue.price_from, venue.price_to)
  const hasRating = venue.avg_rating && venue.avg_rating > 0
  const primaryImage = venue.images?.[0]

  // Google Maps directions URL
  const directionsUrl = venue.postcode
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${venue.address || ''}, ${venue.postcode}`
      )}`
    : null

  if (variant === 'horizontal') {
    return (
      <Card className={cn('group overflow-hidden hover:shadow-lg transition-all duration-300', className)}>
        <div className="flex flex-col sm:flex-row">
          {/* Image */}
          <div className="relative w-full sm:w-48 h-40 sm:h-auto flex-shrink-0 bg-gradient-to-br from-purple-100 to-pink-100">
            {primaryImage ? (
              <Image
                src={primaryImage}
                alt={venue.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 192px"
                placeholder="blur"
                blurDataURL={shimmerDataURL(192, 160)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-4xl opacity-50">🎈</div>
              </div>
            )}
            {venue.isOpen && (
              <Badge className="absolute top-2 left-2 bg-green-500 text-white">
                <Clock className="w-3 h-3 mr-1" />
                Open Now
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <Link href={venueUrl} className="hover:text-purple-600 transition-colors">
                <h3 className="font-bold text-lg leading-tight group-hover:text-purple-600">
                  {venue.name}
                </h3>
              </Link>
              {hasRating && (
                <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-lg flex-shrink-0">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="font-bold text-purple-700 text-sm">
                    {Number(venue.avg_rating).toFixed(1)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{venue.postcode}</span>
              {showDistance && venue.distance !== undefined && (
                <Badge variant="secondary" className="ml-auto">
                  {formatDistance(venue.distance)}
                </Badge>
              )}
            </div>

            {venue.description && (
              <p className="text-sm text-slate-600 line-clamp-2 mb-3">{venue.description}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mb-4">
              {activeFeatures.map((feature) => {
                const Icon = feature.icon
                return (
                  <span
                    key={feature.key}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                      feature.color
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {feature.label}
                  </span>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {priceDisplay && (
                <div>
                  <span className="text-lg font-bold text-purple-600">{priceDisplay}</span>
                  <span className="text-xs text-slate-500 ml-1">per child</span>
                </div>
              )}
              <div className="flex gap-2 ml-auto">
                {directionsUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
                      <Navigation className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" asChild>
                  <Link href={venueUrl}>View Details</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // Default card variant (vertical)
  return (
    <Card
      className={cn(
        'group overflow-hidden hover:shadow-xl transition-all duration-300 h-full flex flex-col',
        className
      )}
    >
      {/* Image area */}
      <div className="relative h-40 bg-gradient-to-br from-purple-100 to-pink-100 overflow-hidden">
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt={venue.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            placeholder="blur"
            blurDataURL={shimmerDataURL(400, 160)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-5xl opacity-30 group-hover:scale-110 transition-transform duration-500">
              🎈
            </div>
          </div>
        )}

        {/* Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {venue.isOpen && (
            <Badge className="bg-green-500 text-white shadow-sm">
              <Clock className="w-3 h-3 mr-1" />
              Open
            </Badge>
          )}
        </div>

        {hasRating && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="font-bold text-slate-900 text-sm">
              {Number(venue.avg_rating).toFixed(1)}
            </span>
            {venue.review_count && venue.review_count > 0 && (
              <span className="text-slate-500 text-xs">({venue.review_count})</span>
            )}
          </div>
        )}

        {showDistance && venue.distance !== undefined && (
          <div className="absolute bottom-3 right-3">
            <Badge className="bg-white/95 text-slate-700 shadow-sm">
              {formatDistance(venue.distance)}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col">
        <Link href={venueUrl} className="block mb-2">
          <h3 className="font-bold text-lg leading-tight group-hover:text-purple-600 transition-colors line-clamp-2">
            {venue.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{venue.postcode}</span>
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activeFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <span
                key={feature.key}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                  feature.color
                )}
              >
                <Icon className="w-3 h-3" />
                {feature.label}
              </span>
            )
          })}
          {activeFeatures.length === 0 && (
            <Badge variant="secondary" className="text-xs">New listing</Badge>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price and CTA */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between gap-3">
            {priceDisplay ? (
              <div>
                <span className="text-lg font-bold text-purple-600">{priceDisplay}</span>
                <p className="text-xs text-slate-500">per child</p>
              </div>
            ) : (
              <div />
            )}
            <Button className="bg-purple-600 hover:bg-purple-700" asChild>
              <Link href={venueUrl}>
                View Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
