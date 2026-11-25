import { calculateDistance } from './geo'
import { isSoftPlayVenueType } from './venueTypes'
import { isVenueIndexable } from './venueContent'
import hubCentres from '@/data/hub-centres.json'

/**
 * "More soft play near <town>" on hub pages with very few venues of their own
 * (added 25 Nov 2026, Phase 3 follow-up). A one-venue hub page otherwise tells a parent
 * nothing the venue page doesn't; listing the closest real venues filed under other
 * hubs makes it answer "soft play near <town>" properly. Distances are straight-line
 * from the town centre (data/hub-centres.json, OS Open Names), never from a venue.
 */

/** Hubs with this many soft play venues or fewer get the section. */
export const THIN_HUB_MAX_VENUES = 2
/** Beyond this a venue isn't "near" the town (same limit as NearTown). */
export const NEAREST_MAX_MILES = 15
export const NEAREST_SHOW = 6

export interface NearestCandidate {
  slug: string
  name: string
  city_slug: string
  lat?: number | string | null
  lng?: number | string | null
  venue_type?: string | null
  /** Undefined on the static export, which only holds listable venues. */
  completeness_score?: number | null
}

export function hubCentre(citySlug: string): { lat: number; lng: number } | null {
  const c = (hubCentres as Record<string, { lat: number; lng: number }>)[citySlug]
  return c ? { lat: c.lat, lng: c.lng } : null
}

/**
 * Closest soft play venues to `centre` that are filed under a different hub, nearest
 * first. Venues without coordinates, non-soft-play types and noindexed venues are left
 * out, so every link goes to a page worth landing on.
 */
export function rankNearest<T extends NearestCandidate>(
  centre: { lat: number; lng: number },
  venues: T[],
  excludeCity: string,
  { maxMiles = NEAREST_MAX_MILES, limit = NEAREST_SHOW } = {},
): { venue: T; miles: number }[] {
  return venues
    .filter((v) => v.city_slug !== excludeCity && isSoftPlayVenueType(v.venue_type))
    .filter((v) => v.completeness_score == null || isVenueIndexable(Number(v.completeness_score), v.venue_type))
    .filter((v) => Number(v.lat) && Number(v.lng))
    .map((venue) => ({ venue, miles: calculateDistance(centre, { lat: Number(venue.lat), lng: Number(venue.lng) }) }))
    .filter((r) => Number.isFinite(r.miles) && r.miles <= maxMiles)
    .sort((a, b) => a.miles - b.miles || a.venue.name.localeCompare(b.venue.name))
    .slice(0, limit)
}
