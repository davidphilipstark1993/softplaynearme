import { cache } from 'react'
import { getPool } from '@/lib/pool'
import { visibleVenueTypeSql } from '@/lib/venueTypes'
import { cities } from '@/lib/venues'
import { getAllStaticTownSlugs, getStaticSoftPlayCount } from '@/lib/staticVenues'

/**
 * The one place venue counts are computed. Every number the site shows for
 * "how many venues" — homepage hero and location cards, the "1,0xx venues"
 * stat, city hub headings, meta descriptions, FAQ and intro copy — comes from
 * here, so they cannot disagree with each other.
 *
 * Definition: an active venue (is_active = true) whose venue_type counts as
 * genuine soft play (see lib/venueTypes.ts), grouped by the city it is
 * published under. The total only includes cities that have a public hub page,
 * so it equals the sum of the per-city numbers a visitor can click through to.
 *
 * Source: the live database when reachable, otherwise the static export using
 * the same venue_type rule. When the DB is reachable it is authoritative — a
 * city with no active rows is 0, not "whatever the JSON still says".
 */
export interface VenueCounts {
  total: number
  byCity: Record<string, number>
  source: 'db' | 'static'
}

function publicCitySlugs(): string[] {
  return [...new Set([...cities.map((c) => c.slug), ...getAllStaticTownSlugs()])]
}

function staticCounts(): VenueCounts {
  const byCity: Record<string, number> = {}
  for (const slug of publicCitySlugs()) byCity[slug] = getStaticSoftPlayCount(slug)
  return { total: sumCounts(byCity), byCity, source: 'static' }
}

function sumCounts(byCity: Record<string, number>): number {
  return Object.values(byCity).reduce((a, b) => a + b, 0)
}

/** Memoized per request; never throws. */
export const getVenueCounts = cache(async (): Promise<VenueCounts> => {
  try {
    const pool = getPool()
    const { rows } = await pool.query<{ city_slug: string; cnt: number }>(
      `SELECT v.city_slug, COUNT(*)::int AS cnt
         FROM venues v
        WHERE v.is_active = true AND ${visibleVenueTypeSql()} AND v.city_slug IS NOT NULL
        GROUP BY v.city_slug`
    )
    const fromDb = new Map(rows.map((r) => [r.city_slug, r.cnt]))
    const byCity: Record<string, number> = {}
    for (const slug of publicCitySlugs()) byCity[slug] = fromDb.get(slug) ?? 0
    return { total: sumCounts(byCity), byCity, source: 'db' }
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
