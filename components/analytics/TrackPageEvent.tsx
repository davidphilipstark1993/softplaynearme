'use client'

import { useEffect } from 'react'
import { gtagEvent } from '@/lib/gtag'

/**
 * Fires one GA4 event when a page mounts (city_view, category_view …), so landing
 * pages can be grouped by type in reports without parsing URLs. Pass page
 * identifiers only — never anything a visitor typed.
 */
export function TrackPageEvent({ name, params }: { name: string; params: Record<string, string | number> }) {
  useEffect(() => {
    gtagEvent(name, params)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
