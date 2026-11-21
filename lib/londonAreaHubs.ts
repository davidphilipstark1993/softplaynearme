/**
 * London area sub-hubs: /soft-play/london/area/{area} (e.g. /soft-play/london/area/east-london).
 *
 * One hub for a city of 9 million is too broad, so London's venues are also grouped by the
 * compass areas in lib/londonAreas.ts. An area only gets its own page when it has at least
 * MIN_AREA_VENUES genuine soft play venues; smaller areas stay on the main London hub only,
 * so no thin pages are published. The `area/` segment keeps these URLs out of the venue
 * namespace (/soft-play/london/{venue-slug}): only a venue with the slug "area" could clash,
 * and scripts/london-areas.test.mjs keeps that from happening.
 *
 * Venues in towns just outside London (Bushey, Epsom: lib/localities "nearby") are left out.
 */
import { cache } from 'react'
import { getPool, STATIC_BUILD } from './pool'
import { visibleVenueTypeSql, isVisibleVenueType } from './venueTypes'
import { getStaticVenuesByTown } from './staticVenues'
import { isNearbyTownVenue } from './localities'
import { LONDON_AREAS, getLondonAreaSlug } from './londonAreas'
import { MIN_AREA_VENUES } from './londonAreaContent'
export { MIN_AREA_VENUES, londonAreaPath, postcodeAreasOf, topRatedOf, buildAreaContent } from './londonAreaContent'


export interface AreaVenue {
  id?: number
  name: string
  slug: string
  city_slug: string
  address?: string
  postcode?: string
  cafe?: boolean
  parking?: boolean
  parties?: boolean
  toddler_area?: boolean
  baby_area?: boolean
  sen_friendly?: boolean
  wheelchair_access?: boolean
  avg_rating?: number | null
  review_count?: number
  price_from?: number
  price_to?: number
  updated_at?: string | null
}

const num = (x: unknown) => (x === null || x === undefined || x === '' ? undefined : Number(x))

/** London's main-list venues (not nearby towns), DB first, static export as fallback. */
export const getLondonVenues = cache(async (): Promise<AreaVenue[]> => {
  if (!STATIC_BUILD) {
    try {
      const { rows } = await getPool().query(
        `SELECT v.id, v.name, v.slug, v.city_slug, v.address, v.postcode, v.cafe, v.parking, v.parties,
                v.toddler_area, v.baby_area, v.sen_friendly, v.wheelchair_access, v.rating, v.reviews_count,
                v.price_from, v.price_to, v.updated_at
           FROM venues v
          WHERE v.city_slug = 'london' AND v.is_active = true AND ${visibleVenueTypeSql()}`
      )
      return rows
        .map((r) => ({ ...r, avg_rating: num(r.rating) ?? null, review_count: num(r.reviews_count) ?? 0, price_from: num(r.price_from), price_to: num(r.price_to) }))
        .filter((v) => !isNearbyTownVenue('london', v))
    } catch {
      // fall through to the static export
    }
  }
  return getStaticVenuesByTown('london')
    .filter((v) => isVisibleVenueType(v.venueType))
    .map((v) => ({
      id: v.id, name: v.name, slug: v.slug, city_slug: 'london', address: v.address, postcode: v.postcode,
      cafe: v.cafe, parking: v.parking, parties: v.parties, toddler_area: v.toddlerArea, baby_area: v.babyArea,
      sen_friendly: v.senFriendly, wheelchair_access: v.wheelchairAccess, avg_rating: v.rating ?? null,
      review_count: v.reviewCount ?? 0, price_from: num(v.priceFrom), price_to: num(v.priceTo),
      updated_at: v.lastVerified || null,
    }))
    .filter((v) => !isNearbyTownVenue('london', v))
})

/** Venues per area slug. */
export async function getLondonAreaGroups(): Promise<Map<string, AreaVenue[]>> {
  const groups = new Map<string, AreaVenue[]>()
  for (const v of await getLondonVenues()) {
    const area = getLondonAreaSlug(v.postcode)
    if (!area) continue
    groups.set(area, [...(groups.get(area) ?? []), v])
  }
  return groups
}

/** Areas with a page of their own (MIN_AREA_VENUES or more venues), in LONDON_AREAS order. */
export async function getLondonAreaHubs(): Promise<{ slug: string; name: string; count: number }[]> {
  const groups = await getLondonAreaGroups()
  return LONDON_AREAS.map((a) => ({ ...a, count: groups.get(a.slug)?.length ?? 0 })).filter((a) => a.count >= MIN_AREA_VENUES)
}

