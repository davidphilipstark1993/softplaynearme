'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navigation, Phone, Globe, Calendar, ExternalLink } from 'lucide-react'
import { cleanAddressForDisplay, isValidPostcode } from '@/lib/sanitize'

interface CTAButtonsProps {
  name: string
  address: string | null
  postcode: string
  lat?: number | null
  lng?: number | null
  phone?: string | null
  website?: string | null
  bookingUrl?: string | null
  googlePlaceId?: string | null
  compact?: boolean
}

export function CTAButtons({
  name,
  address,
  postcode,
  lat,
  lng,
  phone,
  website,
  bookingUrl,
  googlePlaceId,
  compact = false,
}: CTAButtonsProps) {
  // Google Maps URL for directions — null when we have no valid destination
  // (no place ID, no coordinates, and no usable address/postcode), so the
  // button can be hidden instead of linking to a broken "destination=·, null"
  // Maps URL.
  const getDirectionsUrl = (): string | null => {
    if (googlePlaceId) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}&destination_place_id=${googlePlaceId}`
    }
    if (lat && lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    }
    const cleanAddr = cleanAddressForDisplay(address)
    const validPostcode = isValidPostcode(postcode) ? postcode : null
    const destination = [cleanAddr, validPostcode].filter(Boolean).join(', ')
    return destination ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}` : null
  }

  const directionsUrl = getDirectionsUrl()

  // Format phone number for tel: link
  const getPhoneHref = () => {
    if (!phone) return '#'
    return `tel:${phone.replace(/\s/g, '')}`
  }

  // Format website URL
  const getWebsiteUrl = () => {
    if (!website) return '#'
    if (website.startsWith('http://') || website.startsWith('https://')) {
      return website
    }
    return `https://${website}`
  }

  const buttons = [
    {
      key: 'directions',
      href: directionsUrl || '#',
      icon: Navigation,
      label: 'Get Directions',
      variant: 'default' as const,
      always: false,
      show: !!directionsUrl,
    },
    {
      key: 'call',
      href: getPhoneHref(),
      icon: Phone,
      label: compact ? 'Call' : 'Call Now',
      variant: 'outline' as const,
      always: false,
      show: !!phone,
    },
    {
      key: 'website',
      href: getWebsiteUrl(),
      icon: Globe,
      label: 'Website',
      variant: 'outline' as const,
      always: false,
      show: !!website,
      external: true,
    },
    {
      key: 'booking',
      href: bookingUrl || '#',
      icon: Calendar,
      label: 'Book Now',
      variant: 'default' as const,
      always: false,
      show: !!bookingUrl,
      external: true,
      highlight: true,
    },
  ]

  const visibleButtons = buttons.filter((b) => b.always || b.show)

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {visibleButtons.map((button) => {
          const Icon = button.icon
          const isExternal = button.external

          return (
            <Button
              key={button.key}
              variant={button.highlight ? 'default' : button.variant}
              size="sm"
              asChild
              className={button.highlight ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <a
                href={button.href}
                {...(isExternal
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                <Icon className="h-4 w-4" />
                {button.label}
                {isExternal && <ExternalLink className="h-3 w-3 ml-1" />}
              </a>
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Contact & Book</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Primary action - Booking or Directions */}
        {bookingUrl ? (
          <Button asChild className="w-full bg-green-600 hover:bg-green-700">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              <Calendar className="h-4 w-4" />
              Book Now
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </Button>
        ) : null}

        {directionsUrl && (
          <Button asChild className="w-full" variant={bookingUrl ? 'outline' : 'default'}>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4" />
              Get Directions
            </a>
          </Button>
        )}

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          {phone && (
            <Button variant="outline" asChild>
              <a href={getPhoneHref()}>
                <Phone className="h-4 w-4" />
                Call
              </a>
            </Button>
          )}
          {website && (
            <Button variant="outline" asChild>
              <a href={getWebsiteUrl()} target="_blank" rel="noopener noreferrer">
                <Globe className="h-4 w-4" />
                Website
              </a>
            </Button>
          )}
        </div>

        {/* Contact info */}
        {phone && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Phone</p>
            <a href={getPhoneHref()} className="text-sm font-medium hover:text-purple-600">
              {phone}
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
