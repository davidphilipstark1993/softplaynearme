'use client'

import { useEffect } from 'react'

/** Fires a `venue_view` GA4 event once when a venue detail page mounts. */
export function VenueViewTracking({
  venueId,
  citySlug,
  venueSlug,
  plan,
}: {
  venueId?: number
  citySlug: string
  venueSlug: string
  plan?: string
}) {
  useEffect(() => {
    ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.('event', 'venue_view', {
      venue_id: venueId,
      city_slug: citySlug,
      venue_slug: venueSlug,
      plan: plan || 'free',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
