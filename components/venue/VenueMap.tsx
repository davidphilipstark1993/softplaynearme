'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Navigation, ExternalLink } from 'lucide-react'

interface VenueMapProps {
  name: string
  address: string
  postcode: string
  lat: number | null
  lng: number | null
  googlePlaceId?: string | null
}

export function VenueMap({
  name,
  address,
  postcode,
  lat,
  lng,
  googlePlaceId,
}: VenueMapProps) {
  const hasCoordinates = lat && lng

  // Google Maps URL for directions
  const getDirectionsUrl = () => {
    if (googlePlaceId) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(name)}&destination_place_id=${googlePlaceId}`
    }
    if (hasCoordinates) {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${postcode}`)}`
  }

  // Google Maps URL for viewing the location
  const getViewMapUrl = () => {
    if (googlePlaceId) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${googlePlaceId}`
    }
    if (hasCoordinates) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${postcode}`)}`
  }

  // Static map embed URL (no API key needed for basic embed)
  const getStaticMapUrl = () => {
    if (hasCoordinates) {
      return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(`${address}, ${postcode}`)}&z=15&output=embed`
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-purple-600" />
          Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Map embed */}
        <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
          <iframe
            src={getStaticMapUrl()}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map showing ${name}`}
          />
        </div>

        {/* Address */}
        <div className="space-y-1">
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{address}</p>
          <p className="text-sm text-muted-foreground">{postcode}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="flex-1">
            <a
              href={getDirectionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation className="h-4 w-4" />
              Get Directions
            </a>
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <a
              href={getViewMapUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              View on Google Maps
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
