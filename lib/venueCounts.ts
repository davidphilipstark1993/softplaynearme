import { cache } from 'react'
import { getPool } from '@/lib/pool'
import { visibleVenueTypeSql } from '@/lib/venueTypes'
import { cities } from '@/lib/venues'
import { getAllStaticTownSlugs, getStaticCityCounts } from '@/lib/staticVenues'
import { isNearbyTownVenue } from '@/lib/localities'

/**
 * The one place venue counts are computed. Every number the site shows for
 * "how many venues" — homepage hero and location cards, the "1,0xx venues"
 * stat, city hub headings, meta descriptions, FAQ and intro copy — comes from
 * here, so they cannot disagree with each other.
 *
 * Definition: an active venue (is_active = true) whose venue_type counts as
 * genuine soft play (see lib/venueTypes.ts), grouped by the hub it is filed
 * under. A city's number (`byCity`) is its main list — the town's own venues;
 * venues from surrounding towns on hubs with a catchment configured (Hull, see
 * lib/localities.ts) are shown in a separate "Nearby" section and counted in
 * `nearbyByCity` instead, so no venue is in both. `total` is every listing
 * (own + nearby) on a public hub page.
 *
 * Source: the live database when reachable, otherwise the static export using
 * the same venue_type rule. When the DB is reachable it is authoritative — a
 * city with no active rows is 0, not "whatever the JSON still says".
 */
export interface VenueCounts {
  /** Every counted listing across all public hubs (main lists + nearby sections). */
  total: number
  /** Main-list venue count per hub — the number shown on cards, headings and meta. */
  byCity: Record<string, number>
  /** Venues shown in a hub's "Nearby" section rather than its main list. */
  nearbyByCity: Record<string, number>
  source: 'db' | 'static'
}

function publicCitySlugs(): string[] {
  return [...new Set([...cities.map((c) => c.slug), ...getAllStaticTownSlugs()])]
}

function staticCounts(): VenueCounts {
  const byCity: Record<string, number> = {}
  const nearbyByCity: Record<string, number> = {}
  for (const slug of publicCitySlugs()) {
    const { core, nearby } = getStaticCityCounts(slug)
    byCity[slug] = core
    nearbyByCity[slug] = nearby
  }
  return { total: sumCounts(byCity) + sumCounts(nearbyByCity), byCity, nearbyByCity, source: 'static' }
}

function sumCounts(byCity: Record<string, number>): number {
  return Object.values(byCity).reduce((a, b) => a + b, 0)
}

/** Memoized per request; never throws. */
export const getVenueCounts = cache(async (): Promise<VenueCounts> => {
  try {
    const pool = getPool()
    const { rows } = await pool.query<{ id: number; city_slug: string; postcode: string | null }>(
      `SELECT v.id, v.city_slug, v.postcode
         FROM venues v
        WHERE v.is_active = true AND ${visibleVenueTypeSql()} AND v.city_slug IS NOT NULL`
    )
    const byCity: Record<string, number> = {}
    const nearbyByCity: Record<string, number> = {}
    for (const slug of publicCitySlugs()) {
      byCity[slug] = 0
      nearbyByCity[slug] = 0
    }
    for (const r of rows) {
      if (!(r.city_slug in byCity)) continue // no public hub page for this slug
      if (isNearbyTownVenue(r.city_slug, r)) nearbyByCity[r.city_slug]++
      else byCity[r.city_slug]++
    }
    return { total: sumCounts(byCity) + sumCounts(nearbyByCity), byCity, nearbyByCity, source: 'db' }
  } catch {
    // DB unavailable (or SOFTPLAY_STATIC_BUILD=1): fall back to the JSON export.
    return staticCounts()
  }
})

export async function getCityVenueCount(citySlug: string): Promise<number> {
  const { byCity } = await getVenueCounts()
  return byCity[citySlug] ?? 0
}

/** "1,077" — exact, locale-formatted. No "+" because it is a real count. */
export function formatVenueTotal(total: number): string {
  return total.toLocaleString('en-GB')
}
