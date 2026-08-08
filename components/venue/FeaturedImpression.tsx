'use client'

import { useEffect } from 'react'

/**
 * Fires a `featured_impression` GA event once when a featured venue card
 * mounts. A mount-based approximation of "seen" — not true viewport
 * tracking, which is more than this needs.
 */
export function FeaturedImpression({ venueId, city }: { venueId?: number; city: string }) {
  useEffect(() => {
    ;(window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.(
      'event',
      'featured_impression',
      { venue_id: venueId, city }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
