/**
 * Home town ("locality") of a venue, and the core / nearby split used on city
 * hubs. A venue's URL lives under the hub it was filed under (kept stable), but
 * it is described by the town it is really in: Our Imagination Station is in
 * Hessle (HU13), not Hull. Hubs with a configured catchment (data/
 * postcode-localities.json -> hubs) list only their own town's venues in the
 * main list and show venues from surrounding towns in a separate "Nearby"
 * section, so one venue is never presented as both.
 *
 * Unknown stays unknown: no postcode, or a district we haven't mapped, gives
 * null and the venue is treated as belonging to its hub.
 */
import data from '@/data/postcode-localities.json'

interface LocalityData {
  districts: Record<string, string>
  venueOverrides: Record<string, string>
  counties: Record<string, string>
  hubs: Record<string, { core: string[]; nearby: string[] }>
}

const LOCALITIES = data as unknown as LocalityData

/** "HU13 0PQ" -> "HU13". Null if the string isn't a recognisable UK postcode. */
export function postcodeDistrict(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const m = String(postcode).trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/)
  if (m) return m[1]
  // Outward code only ("HU13")
  const outward = String(postcode).trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)$/)
  return outward ? outward[1] : null
}

export interface LocalityInput {
  id?: number | null
  postcode?: string | null
}

/** The town this venue is in, or null if we can't say. */
export function getLocality(venue: LocalityInput): string | null {
  if (venue.id) {
    const override = LOCALITIES.venueOverrides[String(venue.id)]
    if (override) return override
  }
  const district = postcodeDistrict(venue.postcode)
  return district ? LOCALITIES.districts[district] ?? null : null
}

export function getLocalityCounty(locality: string): string | null {
  return LOCALITIES.counties[locality] ?? null
}

export function hasLocalitySplit(citySlug: string): boolean {
  return citySlug in LOCALITIES.hubs
}

/** True when the venue is in a recognised surrounding town of this hub, not the hub's own town. */
export function isNearbyTownVenue(citySlug: string, venue: LocalityInput): boolean {
  const hub = LOCALITIES.hubs[citySlug]
  if (!hub) return false
  const locality = getLocality(venue)
  return !!locality && !hub.core.includes(locality) && hub.nearby.includes(locality)
}

export function splitByLocality<T extends LocalityInput>(citySlug: string, venues: T[]): { core: T[]; nearby: T[] } {
  const core: T[] = []
  const nearby: T[] = []
  for (const v of venues) (isNearbyTownVenue(citySlug, v) ? nearby : core).push(v)
  return { core, nearby }
}

export interface NearbyGroup<T> {
  locality: string
  /** Anchor id for in-page links, e.g. "nearby-hessle". */
  anchor: string
  venues: T[]
}

/** Nearby venues grouped by town, in the hub's configured nearby order. */
export function groupNearbyByLocality<T extends LocalityInput>(citySlug: string, nearby: T[]): NearbyGroup<T>[] {
  const hub = LOCALITIES.hubs[citySlug]
  if (!hub) return []
  const groups = new Map<string, T[]>()
  for (const v of nearby) {
    const locality = getLocality(v)
    if (!locality) continue
    groups.set(locality, [...(groups.get(locality) ?? []), v])
  }
  return hub.nearby
    .filter((l) => groups.has(l))
    .map((locality) => ({
      locality,
      anchor: `nearby-${locality.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      venues: groups.get(locality)!,
    }))
}
