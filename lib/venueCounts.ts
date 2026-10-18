import { cache } from 'react'
import { getPool } from '@/lib/pool'
import { isVisibleVenueType, visibleVenueTypeSql } from '@/lib/venueTypes'
import { cities } from '@/lib/venues'
import { getAllStaticTownSlugs, getStaticVenuesByTown } from '@/lib/staticVenues'
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
  /** Main-list venues per hub that match each path filter (/toddler, /birthday-parties, /sen-friendly). */
  filterCountsByCity: Record<string, FilterCounts>
  source: 'db' | 'static'
}

export interface FilterCounts {
  toddler: number
  'birthday-parties': number
  'sen-friendly': number
}

const emptyFilterCounts = (): FilterCounts => ({ toddler: 0, 'birthday-parties': 0, 'sen-friendly': 0 })

interface CountableVenue {
  id?: number | null
  postcode?: string | null
  toddler_area?: boolean | null
  parties?: boolean | null
  sen_friendly?: boolean | null
}

/** One pass over venues -> every number this module reports. */
function tally(rows: Array<CountableVenue & { city_slug: string }>, source: 'db' | 'static'): VenueCounts {
  const byCity: Record<string, number> = {}
  const nearbyByCity: Record<string, number> = {}
  const filterCountsByCity: Record<string, FilterCounts> = {}
  for (const slug of publicCitySlugs()) {
    byCity[slug] = 0
    nearbyByCity[slug] = 0
    filterCountsByCity[slug] = emptyFilterCounts()
  }
  for (const r of rows) {
    if (!(r.city_slug in byCity)) continue // no public hub page for this slug
    if (isNearbyTownVenue(r.city_slug, r)) {
      nearbyByCity[r.city_slug]++
      continue
    }
    byCity[r.city_slug]++
    const f = filterCountsByCity[r.city_slug]
    if (r.toddler_area) f.toddler++
    if (r.parties) f['birthday-parties']++
    if (r.sen_friendly) f['sen-friendly']++
  }
  return { total: sumCounts(byCity) + sumCounts(nearbyByCity), byCity, nearbyByCity, filterCountsByCity, source }
}

function publicCitySlugs(): string[] {
  return [...new Set([...cities.map((c) => c.slug), ...getAllStaticTownSlugs()])]
}

function staticRows(slug: string) {
  return getStaticVenuesByTown(slug)
    .filter((v) => isVisibleVenueType(v.venueType))
    .map((v) => ({ city_slug: slug, id: v.id, postcode: v.postcode, toddler_area: v.toddlerArea, parties: v.parties, sen_friendly: v.senFriendly }))
}

function staticCounts(): VenueCounts {
  return tally(publicCitySlugs().flatMap(staticRows), 'static')
}

function sumCounts(byCity: Record<string, number>): number {
  return Object.values(byCity).reduce((a, b) => a + b, 0)
}

/** Memoized per request; never throws. */
export const getVenueCounts = cache(async (): Promise<VenueCounts> => {
  try {
    const pool = getPool()
    const { rows } = await pool.query<CountableVenue & { city_slug: string }>(
      `SELECT v.id, v.city_slug, v.postcode, v.toddler_area, v.parties, v.sen_friendly
         FROM venues v
        WHERE v.is_active = true AND ${visibleVenueTypeSql()} AND v.city_slug IS NOT NULL`
    )
    // A hub with no rows at all in the DB (e.g. a hub just added to the site before its
    // venues were moved in the DB) falls back to the export so it isn't shown empty.
    // Once the DB has rows for it, the DB is authoritative again.
    const inDb = new Set(rows.map((r) => r.city_slug))
    const supplement = publicCitySlugs()
      .filter((slug) => !inDb.has(slug))
      .flatMap((slug) => staticRows(slug))
    return tally([...rows, ...supplement], 'db')
  } catch {
    // DB unavailable (or SOFTPLAY_STATIC_BUILD=1): fall back to the JSON export.
    return staticCounts()
  }
})

/**
 * One hub's main-list venue count. Same rules as getVenueCounts() (it runs the same
 * tally over the same WHERE clause) but fetches only that city's rows, so a hub or
 * filter page request doesn't load the whole table just to read one number.
 */
export const getCityVenueCount = cache(async (citySlug: string): Promise<number> => {
  try {
    const pool = getPool()
    const { rows } = await pool.query<CountableVenue & { city_slug: string }>(
      `SELECT v.id, v.city_slug, v.postcode, v.toddler_area, v.parties, v.sen_friendly
         FROM venues v
        WHERE v.city_slug = $1 AND v.is_active = true AND ${visibleVenueTypeSql()}`,
      [citySlug]
    )
    // No DB rows for this hub at all -> use the export (see getVenueCounts).
    return tally(rows.length ? rows : staticRows(citySlug), 'db').byCity[citySlug] ?? 0
  } catch {
    return (await getVenueCounts()).byCity[citySlug] ?? 0
  }
})

/** "1,077" — exact, locale-formatted. No "+" because it is a real count. */
export function formatVenueTotal(total: number): string {
  return total.toLocaleString('en-GB')
}
