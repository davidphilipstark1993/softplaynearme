/**
 * What gets indexed: the one config and the one set of rules (AdSense / thin-content
 * work, Phase 2B, 27 Nov 2026; audit in reports/adsense-phase1-audit.md).
 *
 * Every robots tag, hub merge and sitemap entry asks this module, so the sitemap can
 * never list a URL its page noindexes, and pages re-index on their own once their data
 * qualifies: a hub that reaches 3 venues stops redirecting, a venue that gains a
 * verified fact is indexed on the next render.
 *
 *   venue page   indexable when it carries at least one verified fact beyond what
 *                Google Places gives every listing (name, address, phone, hours,
 *                rating, photo). Park playgrounds, hire and retail never are.
 *                Trampoline parks, play farms and family attractions follow the same
 *                rule; leisure centres also need evidence that they run soft play.
 *   city hub     indexable with >= minHubVenues soft play venues on its main list.
 *                Below that, a hub within hubMergeRadiusKm of an indexable hub
 *                redirects there (its venues are listed on that hub), otherwise it
 *                renders noindex,follow.
 *   filter page  /toddler, /birthday-parties, /sen-friendly: indexable when its hub
 *                is, with >= minFilterVenues matching soft play venues.
 */
import { cache } from 'react'
import hubCentres from '@/data/hub-centres.json'
import { getVenueCounts, type VenueCounts, type FilterCounts } from '@/lib/venueCounts'

export const INDEXING = {
  minHubVenues: 3,
  minFilterVenues: 3,
  hubMergeRadiusKm: 25,
  minVerifiedFacts: 1,
  /** Never indexed (and retired in phase18-01): not what "soft play near me" wants. */
  neverIndexTypes: ['park-playground', 'mobile-hire', 'retail'] as readonly string[],
  /** Need soft play evidence on top of a verified fact. */
  needsSoftPlayEvidence: ['leisure-centre'] as readonly string[],
} as const

// ── Venues ──────────────────────────────────────────────────────────────────

/** Fields read from a venue row (DB snake_case; the static export is mapped to it). */
export interface VenueFacts {
  name?: string | null
  venue_type?: string | null
  price_from?: number | string | null
  pricing_hint?: string | null
  age_range_min?: number | null
  age_range_max?: number | null
  cafe?: boolean | null
  parking?: boolean | null
  parties?: boolean | null
  has_party_rooms?: boolean | null
  toddler_area?: boolean | null
  baby_area?: boolean | null
  sen_friendly?: boolean | null
  has_sen_sessions?: boolean | null
  wheelchair_access?: boolean | null
  has_outdoor_play?: boolean | null
  /** Set by the enrichment review queue (scripts/enrichment/) once a source confirms it. */
  has_soft_play?: boolean | null
  /** Rows in venue_pricing / venue_sessions (owner-entered or verified). */
  price_rows?: number | null
  session_rows?: number | null
}

/**
 * Facts we hold that Google Places does not give every listing. Each one is a
 * confirmed yes (a false flag means "not confirmed", not "no"), so this counts what a
 * page can genuinely tell a parent beyond the map pin.
 */
export function verifiedFacts(v: VenueFacts): string[] {
  const out: string[] = []
  if ((v.price_from != null && v.price_from !== '') || (v.pricing_hint && v.pricing_hint.trim()) || Number(v.price_rows) > 0) out.push('price')
  if (Number(v.session_rows) > 0) out.push('session times')
  if (v.age_range_min != null || v.age_range_max != null) out.push('age range')
  if (v.cafe) out.push('café')
  if (v.parking) out.push('parking')
  if (v.parties || v.has_party_rooms) out.push('parties')
  if (v.toddler_area) out.push('toddler area')
  if (v.baby_area) out.push('baby area')
  if (v.sen_friendly || v.has_sen_sessions) out.push('SEN sessions')
  if (v.wheelchair_access) out.push('wheelchair access')
  if (v.has_outdoor_play) out.push('outdoor play')
  return out
}

const SOFT_PLAY_NAME = /soft ?play|play ?(zone|area|frame|centre|center|barn|village|town)|indoor play/i

export function isVenueIndexable(v: VenueFacts): boolean {
  const type = v.venue_type || 'indoor'
  if (INDEXING.neverIndexTypes.includes(type)) return false
  if (verifiedFacts(v).length < INDEXING.minVerifiedFacts) return false
  if (INDEXING.needsSoftPlayEvidence.includes(type)) return !!v.has_soft_play || SOFT_PLAY_NAME.test(v.name ?? '')
  return true
}

/** Static export (camelCase) -> VenueFacts. */
export function staticVenueFacts(sv: {
  name?: string; venueType?: string | null; priceFrom?: number | null; pricingHint?: string | null
  ageRangeMin?: number | null; ageRangeMax?: number | null; cafe?: boolean; parking?: boolean; parties?: boolean
  hasPartyRooms?: boolean; toddlerArea?: boolean; babyArea?: boolean; senFriendly?: boolean; hasSenSessions?: boolean
  wheelchairAccess?: boolean; hasOutdoorPlay?: boolean; hasSoftPlay?: boolean | null
}): VenueFacts {
  return {
    name: sv.name, venue_type: sv.venueType, price_from: sv.priceFrom, pricing_hint: sv.pricingHint,
    age_range_min: sv.ageRangeMin ?? null, age_range_max: sv.ageRangeMax ?? null,
    cafe: sv.cafe, parking: sv.parking, parties: sv.parties, has_party_rooms: sv.hasPartyRooms,
    toddler_area: sv.toddlerArea, baby_area: sv.babyArea, sen_friendly: sv.senFriendly, has_sen_sessions: sv.hasSenSessions,
    wheelchair_access: sv.wheelchairAccess, has_outdoor_play: sv.hasOutdoorPlay, has_soft_play: sv.hasSoftPlay ?? null,
  }
}

/** Every column isVenueIndexable reads, for SELECTs (DB column names). */
export const VENUE_FACT_COLUMNS =
  'v.name, v.venue_type, v.price_from, v.pricing_hint, v.age_range_min, v.age_range_max, v.cafe, v.parking, v.parties, v.has_party_rooms, ' +
  'v.toddler_area, v.baby_area, v.sen_friendly, v.has_sen_sessions, v.wheelchair_access, v.has_outdoor_play'

/** SELECT fragment adding price_rows / session_rows (needs the venues table aliased `v`). */
export const VENUE_FACT_COUNTS_SQL =
  '(SELECT COUNT(*) FROM venue_pricing p WHERE p.venue_id = v.id)::int AS price_rows, ' +
  '(SELECT COUNT(*) FROM venue_sessions s WHERE s.venue_id = v.id)::int AS session_rows'

// ── Hubs ────────────────────────────────────────────────────────────────────

export interface HubState {
  /** Soft play venues on the hub's main list. */
  count: number
  indexable: boolean
  /** Set when the hub is too thin and an indexable hub is close: it redirects there. */
  mergeInto: string | null
  /** Straight-line km to mergeInto. */
  mergeKm: number | null
}

type Centre = { lat: number; lng: number }
const CENTRES = hubCentres as Record<string, Centre>

function km(a: Centre, b: Centre): number {
  const R = 6371, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Pure: hub states from per-hub counts and centres. Merge targets are always indexable
 * hubs, so there are no chains. A hub without a known centre is never merged.
 */
export function computeHubStates(byCity: Record<string, number>, centres: Record<string, Centre> = CENTRES): Record<string, HubState> {
  const big = Object.keys(byCity).filter((s) => byCity[s] >= INDEXING.minHubVenues)
  const out: Record<string, HubState> = {}
  for (const [slug, count] of Object.entries(byCity)) {
    if (count >= INDEXING.minHubVenues) { out[slug] = { count, indexable: true, mergeInto: null, mergeKm: null }; continue }
    let best: string | null = null, bestKm = Infinity
    const c = centres[slug]
    if (c && count > 0) {
      for (const b of big) {
        const bc = centres[b]
        if (!bc) continue
        const d = km(c, bc)
        if (d < bestKm || (d === bestKm && best !== null && b < best)) { best = b; bestKm = d }
      }
    }
    const merge = best && bestKm <= INDEXING.hubMergeRadiusKm ? best : null
    out[slug] = { count, indexable: false, mergeInto: merge, mergeKm: merge ? Math.round(bestKm * 10) / 10 : null }
  }
  return out
}

export const getHubStates = cache(async (): Promise<Record<string, HubState>> => computeHubStates((await getVenueCounts()).byCity))

export async function getHubState(citySlug: string): Promise<HubState> {
  return (await getHubStates())[citySlug] ?? { count: 0, indexable: false, mergeInto: null, mergeKm: null }
}

/** Hubs that redirect into `target`, nearest first. */
export async function getMergedInto(target: string): Promise<string[]> {
  const states = await getHubStates()
  return Object.entries(states)
    .filter(([, s]) => s.mergeInto === target)
    .sort((a, b) => (a[1].mergeKm ?? 0) - (b[1].mergeKm ?? 0) || a[0].localeCompare(b[0]))
    .map(([slug]) => slug)
}

/** Where a link to this hub should point: itself, or the hub it is merged into. */
export function hubHref(citySlug: string, states: Record<string, HubState>): string {
  return `/soft-play/${states[citySlug]?.mergeInto ?? citySlug}`
}

// ── Filter pages ────────────────────────────────────────────────────────────

export type FilterSlug = keyof FilterCounts

export function isFilterIndexable(matching: number, hub: HubState | undefined): boolean {
  return !!hub?.indexable && matching >= INDEXING.minFilterVenues
}

export function filterIndexableFromCounts(counts: VenueCounts, states: Record<string, HubState>, citySlug: string, filter: FilterSlug): boolean {
  return isFilterIndexable(counts.filterCountsByCity[citySlug]?.[filter] ?? 0, states[citySlug])
}
