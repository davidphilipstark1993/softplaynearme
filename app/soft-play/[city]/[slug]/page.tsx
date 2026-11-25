import Link from 'next/link'
import { cleanVenueDescription, cleanVenueTips, cleanWhatToExpect } from '@/lib/venueCopy'
import { venueFacts, buildVenueSeoTitle, buildVenueMetaDescription, quickFactRows, nearbyText, parseWeekHours, weekHoursForSchema, NEARBY_MILES, NEARBY_LIST_MAX, type VenueFacts } from '@/lib/venueSnippet'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCityBySlug, getAllCitySlugs, getNearbyCities } from '@/lib/venues'
import {
  MapPin,
  Star,
  Navigation,
  Camera,
  Clock,
  Phone,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { Metadata } from 'next'
import { getPool, STATIC_BUILD } from '@/lib/pool'
import { getHubGuide } from '@/lib/hubGuides'
import { pendingSources } from '@/lib/redirects'
import { calculateDistance, formatDistance, getBoundingBox } from '@/lib/geo'
import { visibleVenueTypeSql, NON_SOFT_PLAY_VENUE_TYPE_LABELS, type NonSoftPlayVenueType } from '@/lib/venueTypes'
import { getStaticVenue, getStaticTownBySlug, getStaticVenuesByTown, getAllStaticTownSlugs, type StaticVenue } from '@/lib/staticVenues'
import { isVisibleVenueType } from '@/lib/venueTypes'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { buildLocalBusinessSchema, buildBreadcrumbSchema, buildFAQSchema } from '@/lib/schema'
import { JsonLd } from '@/components/seo/JsonLd'
import { getStoredReviews } from '@/lib/reviewsStore'
import { isVerified } from '@/lib/plans'
import { ReviewSection } from '@/components/venue/ReviewSection'
import { cleanAddressForDisplay, formatAddressLine } from '@/lib/sanitize'
import { isUsablePhotoUrl } from '@/lib/imageUtils'
import {
  generateVenueDescription,
  generateVenueFAQs,
  computeCompletenessScore,
  isVenueIndexable,
} from '@/lib/venueContent'

import { PhotoGallery } from '@/components/venue/PhotoGallery'
import { PricingTable } from '@/components/venue/PricingTable'
import { OpeningHours } from '@/components/venue/OpeningHours'
import { VenueMap } from '@/components/venue/VenueMap'
import { FacilitiesGrid, FacilitiesBadges } from '@/components/venue/FacilitiesGrid'
import { SpecialSessions } from '@/components/venue/SpecialSessions'
import { CTAButtons } from '@/components/venue/CTAButtons'
import { QuickFactsPanel } from '@/components/venue/QuickFactsPanel'
import { EnquiryForm } from '@/components/venue/EnquiryForm'
import { ReportIssueLink } from '@/components/venue/ReportIssueLink'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'
import { AdSlot } from '@/components/ads/AdSlot'
import { VenueViewTracking } from '@/components/venue/VenueViewTracking'
import { cleanHoursText, hasOpeningHours, hasStructuredHours } from '@/lib/venueFacts'
import { getVenueTown } from '@/lib/localities'
import { getOwnerData } from '@/lib/claims/db'
import { mergeOwnerData, upcomingEvents, priceLines, type OwnerData } from '@/lib/ownerData'
import { ClaimCta } from '@/components/owner/ClaimCta'

interface PageProps {
  params: Promise<{ city: string; slug: string }>
}

interface Venue {
  review_snippet?: string | null
  id: number
  name: string
  slug: string
  city_slug: string
  address: string | null
  postcode: string
  lat?: number
  lng?: number
  phone?: string
  email?: string
  website?: string
  booking_url?: string
  description?: string
  opening_hours?: Record<string, string>
  opening_hours_text?: string | null
  price_range?: string
  price_from?: number
  price_to?: number
  facilities?: Record<string, boolean>
  google_place_id?: string
  featured?: boolean
  plan?: string
  plan_status?: string
  // Core facility booleans (original columns)
  cafe: boolean
  parking: boolean
  free_parking?: boolean
  parties: boolean
  toddler_area: boolean
  baby_area: boolean
  sen_friendly: boolean
  wheelchair_access: boolean
  free_wifi: boolean
  // Phase 2 facility additions
  sensory_area?: boolean
  role_play_area?: boolean
  party_rooms?: boolean
  toilets?: boolean
  baby_change?: boolean
  disabled_access?: boolean
  // Age
  age_ranges?: string[]
  age_range_min?: number
  age_range_max?: number
  // Classification
  venue_type?: string
  indoor_or_outdoor?: string
  // Booking
  accepts_walk_ins?: boolean
  prebooking_required?: boolean
  membership_available?: boolean
  // Visitor info
  description_short?: string
  what_to_expect?: string
  tips_before_visiting?: string
  session_info?: string
  peak_times?: string
  // Ratings
  google_rating?: number
  review_count?: number
  // Ownership
  claimed_by_owner?: boolean
  /** The owner's own data (venue_owner_data), already merged into the fields above. */
  _owner?: OwnerData | null
  owner_submitted?: boolean
  // SEO overrides
  seo_title?: string
  meta_description?: string
  faq_json?: Array<{ question: string; answer: string }>
  local_area_intro?: string
  completeness_score?: number
  images?: string[]
  main_image_url?: string
  has_under_1s?: boolean
  has_outdoor_play?: boolean
  has_party_rooms?: boolean
  has_sen_sessions?: boolean
  last_verified_at?: string
}

interface Review {
  id: number
  reviewer_name: string
  rating: number
  comment: string
  created_at: string
}

interface PricingItem {
  id: number
  price_type: string
  age_group: string
  price: number
  duration_minutes: number
  notes: string
}

interface Session {
  id: number
  session_type: string
  day_of_week: number
  start_time: string
  end_time: string
  description: string
  booking_required: boolean
}

interface Photo {
  id: number
  url: string
  alt_text: string
  is_primary: boolean
}

// Wrapped in React's cache() so generateMetadata() and the page component —
// both of which call this per request — share one DB round trip instead of
// querying (and, now, logging a view) twice for the same request.
const getVenue = cache(async function getVenue(citySlug: string, slug: string): Promise<Venue | null> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venues WHERE city_slug = $1 AND slug = $2 AND is_active = true',
        [citySlug, slug]
      )
      let row = result.rows[0]
      // Bridge for a move whose 301 is deployed before the DB row is updated
      // (lib/redirects.ts): this new URL renders the venue from its old row, as
      // the new URL, so neither the old nor the new address ever 404s.
      if (!row) {
        for (const source of pendingSources(`/soft-play/${citySlug}/${slug}`)) {
          const [, , fromCity, fromSlug] = source.split('/')
          if (!fromSlug) continue
          const prior = await client.query(
            'SELECT * FROM venues WHERE city_slug = $1 AND slug = $2 AND is_active = true',
            [fromCity, fromSlug]
          )
          if (prior.rows[0]) {
            row = { ...prior.rows[0], city_slug: citySlug, slug }
            break
          }
        }
      }
      if (row) {
        // First-party view count for the dashboard Insights card / monthly
        // insights email (see scripts/migrateInsights.mjs) — a rough proxy
        // for traffic (includes ISR background revalidations, not just
        // unique visitors), not a replacement for GA4.
        try {
          await client.query(
            `INSERT INTO venue_page_events (venue_id, event_type) VALUES ($1, 'view')`,
            [row.id]
          )
        } catch {
          // Table may not exist yet in an environment that hasn't run the
          // migration — never let this break the page render.
        }
        const base = {
          ...row,
          // Imports left a few rows holding the literal "nan" / "https://nan"
          // placeholder; treat those as no website so no dead link renders.
          website: /^(https?:\/\/)?(nan|none|null)\/?$/i.test(String(row.website ?? '').trim())
            ? null
            : row.website,
          featured: !!row.featured && (!row.featured_until || new Date(row.featured_until) > new Date()),
        }
        // Owner data (venue_owner_data) wins over the Google / generated base row. It lives
        // in its own table, so no ingest or enrichment script can overwrite it.
        const owner = await getOwnerData(row.id)
        return { ...mergeOwnerData(base, owner), _owner: owner }
      }
      // A real query that simply found nothing (wrong slug, or a venue that
      // exists but is_active = false) must 404 — it must NOT fall through to
      // the static snapshot below, which has no concept of is_active and
      // would silently keep serving a deactivated venue from stale data.
      // Only a genuine DB error (caught below) should fall back to static.
      return null
    } finally {
      client.release()
    }
  } catch (error) {
    // Static builds skip the DB on purpose — don't log once per page for that.
    if (!STATIC_BUILD) {
      console.error('Database unavailable, falling back to static data:', error)
    }
  }

  const staticVenue = getStaticVenue(citySlug, slug)
  if (staticVenue) {
    return staticToVenue(staticVenue)
  }

  return null
})

function staticToVenue(sv: StaticVenue): Venue {
  return {
    id: 0,
    name: sv.name,
    slug: sv.slug,
    city_slug: sv.townSlug,
    address: sv.address,
    postcode: sv.postcode,
    lat: sv.lat ?? undefined,
    lng: sv.lng ?? undefined,
    phone: sv.phone || undefined,
    website: sv.website || undefined,
    description: sv.description || sv.notes || undefined,
    rating: sv.rating ?? undefined,
    reviews_count: sv.reviewCount ?? undefined,
    cafe: sv.cafe ?? false,
    parking: sv.parking ?? false,
    parties: sv.parties ?? false,
    toddler_area: sv.toddlerArea ?? false,
    baby_area: sv.babyArea ?? false,
    sen_friendly: sv.senFriendly ?? false,
    wheelchair_access: sv.wheelchairAccess ?? false,
    free_wifi: sv.freeWifi ?? false,
    has_outdoor_play: sv.hasOutdoorPlay ?? false,
    has_party_rooms: sv.hasPartyRooms ?? false,
    has_sen_sessions: sv.hasSenSessions ?? false,
    opening_hours_text: sv.openingHoursText || undefined,
    price_from: sv.priceFrom ?? undefined,
    price_to: sv.priceTo ?? undefined,
    main_image_url: sv.mainImageUrl ?? undefined,
    featured: sv.featured ?? false,
    venue_type: sv.venueType,
    _mapsUrl: sv.mapsUrl,
    _isStatic: true,
    _staticId: sv.id,
  } as Venue & { _mapsUrl?: string; _isStatic?: boolean; _staticId?: number }
}

async function getReviews(venueId: number, citySlug: string, venueSlug: string): Promise<Review[]> {
  const storedFallback = async () =>
    (await getStoredReviews({
      venueId: venueId > 0 ? venueId : undefined,
      citySlug,
      venueSlug,
    })) as Review[]

  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM reviews WHERE venue_id = $1 AND approved = true ORDER BY created_at DESC',
        [venueId]
      )
      if (result.rows.length > 0) return result.rows
      return storedFallback()
    } finally {
      client.release()
    }
  } catch {
    return storedFallback()
  }
}

async function getPricing(venueId: number): Promise<PricingItem[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venue_pricing WHERE venue_id = $1 ORDER BY price_type, age_group',
        [venueId]
      )
      return result.rows
    } catch {
      return []
    } finally {
      client.release()
    }
  } catch {
    return []
  }
}

async function getSessions(venueId: number): Promise<Session[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venue_sessions WHERE venue_id = $1 ORDER BY session_type, day_of_week',
        [venueId]
      )
      return result.rows
    } catch {
      return []
    } finally {
      client.release()
    }
  } catch {
    return []
  }
}

async function getPhotos(venueId: number): Promise<Photo[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT * FROM venue_photos WHERE venue_id = $1 ORDER BY is_primary DESC, display_order ASC',
        [venueId]
      )
      return result.rows
    } catch {
      return []
    } finally {
      client.release()
    }
  } catch {
    return []
  }
}

export const revalidate = 3600

/**
 * Venue pages are not pre-rendered at build time. Each one renders from the
 * database on its first visit after a deploy, then is cached for `revalidate`.
 *
 * Production builds run with SOFTPLAY_STATIC_BUILD=1, so pre-rendering here
 * produced pages from data/generated/ with no venue id and no owner data
 * (venue_owner_data). Every deploy then served those for up to an hour,
 * hiding owners' photos, prices and events and showing the claim prompt on
 * venues that are already claimed.
 */
export async function generateStaticParams() {
  return []
}

interface SimilarVenue {
  name: string
  slug: string
  postcode: string
  toddler_area: boolean
  sen_friendly: boolean
  parties: boolean
}

/**
 * Get venues in the same city that share at least one key tag with the current venue.
 * Results are ranked by number of matching tags, then by name.
 */
async function getSimilarVenues(
  citySlug: string,
  excludeSlug: string,
  tags: { toddler_area: boolean; sen_friendly: boolean; parties: boolean }
): Promise<SimilarVenue[]> {
  const hasAnyTag = tags.toddler_area || tags.sen_friendly || tags.parties
  if (!hasAnyTag) return []

  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query<SimilarVenue>(
        `SELECT name, slug, postcode, toddler_area, sen_friendly, parties
         FROM venues
         WHERE city_slug = $1
           AND slug != $2
           AND is_active = true
           AND (
             ($3 AND toddler_area = true) OR
             ($4 AND sen_friendly = true) OR
             ($5 AND parties = true)
           )
         ORDER BY
           (CASE WHEN $3 AND toddler_area THEN 1 ELSE 0 END +
            CASE WHEN $4 AND sen_friendly THEN 1 ELSE 0 END +
            CASE WHEN $5 AND parties THEN 1 ELSE 0 END) DESC,
           name ASC
         LIMIT 4`,
        [citySlug, excludeSlug, tags.toddler_area, tags.sen_friendly, tags.parties]
      )
      if (result.rows.length > 0) return result.rows
    } finally {
      client.release()
    }
  } catch {
    // Fall through to static
  }

  const staticVenues = getStaticVenuesByTown(citySlug)
  return staticVenues
    .filter(v => v.slug !== excludeSlug)
    .filter(v =>
      (tags.toddler_area && v.toddlerArea) ||
      (tags.sen_friendly && v.senFriendly) ||
      (tags.parties && v.parties)
    )
    .slice(0, 4)
    .map(v => ({
      name: v.name,
      slug: v.slug,
      postcode: v.postcode,
      toddler_area: v.toddlerArea ?? false,
      sen_friendly: v.senFriendly ?? false,
      parties: v.parties ?? false,
    }))
}

interface NearestVenue { name: string; slug: string; citySlug: string; area: string | null; miles: number }

/**
 * The closest soft play venues by straight-line distance, crossing hub boundaries (a Worthing
 * venue can list Littlehampton or Brighton ones). Only genuine soft play types, only active
 * rows, within 25 miles. Returns [] if the venue has no coordinates or the DB is unavailable.
 */
async function getNearestVenues(from: { id?: number; lat?: number | null; lng?: number | null }, limit = 6): Promise<NearestVenue[]> {
  const lat = Number(from.lat)
  const lng = Number(from.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return []
  try {
    const box = getBoundingBox({ lat, lng }, 25)
    const { rows } = await getPool().query(
      `SELECT id, name, slug, city_slug, postcode, lat, lng FROM venues v
        WHERE v.is_active = true AND ${visibleVenueTypeSql()} AND v.id <> $1
          AND v.lat BETWEEN $2 AND $3 AND v.lng BETWEEN $4 AND $5`,
      [from.id ?? -1, box.minLat, box.maxLat, box.minLng, box.maxLng]
    )
    return rows
      .map((r: { id: number; name: string; slug: string; city_slug: string; postcode: string | null; lat: string; lng: string }) => ({
        name: r.name,
        slug: r.slug,
        citySlug: r.city_slug,
        area: getVenueTown({ id: r.id, postcode: r.postcode }),
        miles: calculateDistance({ lat, lng }, { lat: Number(r.lat), lng: Number(r.lng) }),
      }))
      .filter((r: NearestVenue) => r.miles <= 25)
      .sort((a: NearestVenue, b: NearestVenue) => a.miles - b.miles)
      .slice(0, limit)
  } catch {
    return []
  }
}

/**
 * Every other soft play venue (directory types only, active) within NEARBY_MILES of
 * this one, closest first, across hub boundaries. generateMetadata and the page share
 * it (cache), so the meta's "Compare N other soft plays" always matches the list the
 * page shows. Falls back to the static export when the DB is unavailable.
 */
const getVenuesWithin = cache(async function getVenuesWithin(
  id: number,
  citySlug: string,
  slug: string,
  latIn: number | string | null | undefined,
  lngIn: number | string | null | undefined,
): Promise<NearestVenue[]> {
  const lat = Number(latIn)
  const lng = Number(lngIn)
  if (latIn == null || lngIn == null || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return []
  const box = getBoundingBox({ lat, lng }, NEARBY_MILES)
  type Row = { id: number; name: string; slug: string; city_slug: string; postcode: string | null; lat: number | string; lng: number | string }
  let rows: Row[] | null = null
  if (!STATIC_BUILD) {
    try {
      const res = await getPool().query(
        `SELECT id, name, slug, city_slug, postcode, lat, lng FROM venues v
          WHERE v.is_active = true AND ${visibleVenueTypeSql()}
            AND v.lat BETWEEN $1 AND $2 AND v.lng BETWEEN $3 AND $4`,
        [box.minLat, box.maxLat, box.minLng, box.maxLng]
      )
      rows = res.rows
    } catch {
      rows = null
    }
  }
  if (!rows) {
    rows = getAllStaticTownSlugs()
      .flatMap((t) => getStaticVenuesByTown(t))
      .filter((v) => isVisibleVenueType(v.venueType) && v.lat != null && v.lng != null)
      .map((v) => ({ id: v.id ?? 0, name: v.name, slug: v.slug, city_slug: v.townSlug, postcode: v.postcode, lat: v.lat!, lng: v.lng! }))
  }
  return rows
    .filter((r) => !(r.city_slug === citySlug && r.slug === slug) && !(id > 0 && r.id === id))
    .map((r) => ({
      name: r.name,
      slug: r.slug,
      citySlug: r.city_slug,
      area: getVenueTown({ id: r.id, postcode: r.postcode }),
      miles: calculateDistance({ lat, lng }, { lat: Number(r.lat), lng: Number(r.lng) }),
    }))
    .filter((r) => r.miles <= NEARBY_MILES)
    .sort((a, b) => a.miles - b.miles || a.name.localeCompare(b.name))
})

/** Facts for the title, meta and Quick facts block — one source for all three. */
async function getVenueFacts(venue: Venue, city: string, slug: string, town: string): Promise<{ facts: VenueFacts; within: NearestVenue[] }> {
  const id = venue.id || (venue as { _staticId?: number })._staticId || 0
  const within = await getVenuesWithin(id, city, slug, venue.lat, venue.lng)
  const facts = venueFacts(venue, {
    town,
    nearbyCount: Math.min(within.length, NEARBY_LIST_MAX),
    nearbyMore: within.length > NEARBY_LIST_MAX,
  })
  return { facts, within: within.slice(0, NEARBY_LIST_MAX) }
}

/** Get nearby venues in the same city (excluding this one) */
async function getNearbyVenues(citySlug: string, excludeSlug: string): Promise<{ name: string; slug: string; postcode: string }[]> {
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(
        'SELECT name, slug, postcode FROM venues WHERE city_slug = $1 AND slug != $2 AND is_active = true ORDER BY name LIMIT 6',
        [citySlug, excludeSlug]
      )
      if (result.rows.length > 0) return result.rows
    } finally {
      client.release()
    }
  } catch {
    // Fall through to static
  }

  const staticVenues = getStaticVenuesByTown(citySlug)
  return staticVenues
    .filter(v => v.slug !== excludeSlug)
    .slice(0, 6)
    .map(v => ({ name: v.name, slug: v.slug, postcode: v.postcode }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, slug } = await params
  const venue = await getVenue(city, slug)
  const cityConfig = getCityBySlug(city)
  const staticTown = getStaticTownBySlug(city)

  if (!venue) {
    // No suffix — the root layout's title template appends it. Never index a
    // not-found response, otherwise it inherits the root `index: true`.
    return { title: 'Venue Not Found', robots: { index: false, follow: false } }
  }

  const cityName = cityConfig?.name || staticTown?.name || city
  const county = cityConfig?.county || ''
  // The town the venue is really in (Hessle for a HU13 venue filed under Hull).
  const homeTown = getVenueTown({ id: venue.id || (venue as { _staticId?: number })._staticId, postcode: venue.postcode }) ?? cityName

  // Built from the venue's own facts (lib/venueSnippet.ts). The stored seo_title /
  // meta_description columns hold bulk-generated text (some cut off, some naming the
  // hub instead of the town) and are no longer used.
  const { facts } = await getVenueFacts(venue, city, slug, homeTown)
  const title = buildVenueSeoTitle(facts, venue.venue_type)
  const description = buildVenueMetaDescription(facts)

  // Noindex very thin pages (name + address only, no useful content)
  const score = venue.completeness_score ??
    computeCompletenessScore({ ...venue, city: cityName, county })
  const shouldNoindex = !isVenueIndexable(score, venue.venue_type)

  return {
    title: { absolute: title },
    description,
    robots: shouldNoindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`,
      type: 'website',
      siteName: 'Soft Play Near Me',
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
    alternates: {
      canonical: `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`,
    },
  }
}

export default async function VenuePage({ params }: PageProps) {
  const { city, slug } = await params
  const venue = await getVenue(city, slug)
  const cityConfig = getCityBySlug(city)
  const staticTown = getStaticTownBySlug(city)
  const relatedCities = cityConfig ? getNearbyCities(city).slice(0, 6) : []

  if (!venue) {
    notFound()
  }

  const cityName = cityConfig?.name || staticTown?.name || city
  const county = cityConfig?.county || ''
  const homeTown = getVenueTown({ id: venue.id || (venue as { _staticId?: number })._staticId, postcode: venue.postcode }) ?? cityName
  const { facts, within: withinVenues } = await getVenueFacts(venue, city, slug, homeTown)
  const factRows = quickFactRows(facts)
  // Per-day table: structured hours as stored, else the Google weekday text parsed to a
  // full week. (Google's { source, weekday_text } object used to reach the table as-is
  // and render every day as "Closed".) Anything else falls to the text card below.
  const hoursTable =
    weekHoursForSchema(parseWeekHours(venue)) ??
    (hasStructuredHours(venue.opening_hours) ? (venue.opening_hours as Record<string, string>) : null)
  const compareLine = nearbyText(facts)
  const isStaticVenue = (venue as any)._isStatic === true

  // Fetch all related data in parallel
  const venueTags = {
    toddler_area: venue.toddler_area ?? false,
    sen_friendly: venue.sen_friendly ?? false,
    parties: venue.parties ?? false,
  }
  const guideHub = !!getHubGuide(city)
  const [reviews, pricing, sessions, photos, nearbyVenues, similarVenues, nearestVenues] = await Promise.all([
    getReviews(venue.id, city, slug),
    getPricing(venue.id),
    getSessions(venue.id),
    getPhotos(venue.id),
    getNearbyVenues(city, slug),
    getSimilarVenues(city, slug, venueTags),
    guideHub ? getNearestVenues(venue) : Promise.resolve([] as NearestVenue[]),
  ])

  // Derive section label from the venue's primary feature tag
  const similarFeatureLabel = venue.toddler_area
    ? 'Toddler-Friendly'
    : venue.sen_friendly
      ? 'SEN-Friendly'
      : venue.parties
        ? 'Party'
        : null

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : ((venue as any).rating ? Number((venue as any).rating) : 0)

  const baseUrl = 'https://www.softplaynearme.co.uk'
  const usablePhotos = photos.filter((p) => isUsablePhotoUrl(p.url))
  const ownerPhotos = (venue._owner?.photos ?? []).map((url, i) => ({ id: -1 - i, url, alt_text: `${venue.name}, photo from the venue`, is_primary: i === 0 }))
  const galleryPhotos = ownerPhotos.length > 0
    ? [...ownerPhotos, ...usablePhotos.filter((p) => !ownerPhotos.some((o) => o.url === p.url))]
    : usablePhotos.length > 0
    ? usablePhotos
    : isUsablePhotoUrl(venue.main_image_url)
      ? [{ id: 0, url: venue.main_image_url, alt_text: `${venue.name}, photo from its Google listing`, is_primary: true }]
      : []

  // ── Content generation ─────────────────────────────────────────────────
  // The facility columns default to false, so false only means "no" when the venue's owner
  // said so (owner form: café, parking); otherwise it is "not confirmed". accepts_walk_ins
  // defaults to true and nothing ever confirms it, so it is never stated.
  const ownerSaid = venue._owner?.facilities ?? {}
  const venueContentInput = {
    ...venue,
    city: homeTown,
    county: homeTown === cityName ? county : '',
    cafe: venue.cafe || (ownerSaid.cafe === false ? false : undefined),
    parking: venue.parking || (ownerSaid.parking === false ? false : undefined),
    accepts_walk_ins: undefined,
  }

  // Stored description without generator filler (lib/venueCopy.ts). An owner's own text
  // passes through untouched. Too little left: lead with the address line, or generate.
  const cleanedDescription = venue._owner?.owner_description ? venue.description ?? '' : cleanVenueDescription(venue.description, venue.review_snippet)
  const descAddress = formatAddressLine(venue.address, venue.postcode)
  const KIND: Record<string, string> = { indoor: 'soft play centre', pub: 'pub with soft play', 'leisure-centre': 'leisure centre', 'mobile-hire': 'mobile soft play hire business', retail: 'shop' }
  const kind = KIND[venue.venue_type ?? 'indoor'] ?? NON_SOFT_PLAY_VENUE_TYPE_LABELS[venue.venue_type as NonSoftPlayVenueType]?.toLowerCase() ?? 'play venue'
  const descLead = descAddress && !cleanedDescription.startsWith(venue.name)
    ? `${venue.name} is ${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind} at ${descAddress}.`
    : ''
  const displayDescription = cleanedDescription
    ? [descLead, cleanedDescription].filter(Boolean).join(cleanedDescription.includes('\n\n') ? '\n\n' : ' ')
    : generateVenueDescription(venueContentInput)
  const expect = cleanWhatToExpect(venue.what_to_expect)
  const tips = cleanVenueTips(venue.tips_before_visiting)

  // FAQs: prefer stored faq_json, otherwise generate from structured data
  const faqs: Array<{ question: string; answer: string }> =
    (venue.faq_json && venue.faq_json.length > 0)
      ? venue.faq_json
      : generateVenueFAQs(venueContentInput)

  const faqSchema = buildFAQSchema(faqs)

  // ── LocalBusiness schema – uses reusable builder from lib/schema.ts ────
  // Reviews are embedded directly into this single SportsActivityLocation
  // object (rather than a second, separate LocalBusiness block) so search
  // engines and AI answer engines see one unambiguous entity per venue.
  const localBusinessSchema = buildLocalBusinessSchema({
    name: venue.name,
    // Our own summary only: the Google reviewer's quote is not the business's description.
    description: displayDescription.replace(/\s*One Google reviewer wrote: “[^”]*”/g, '').replace(/\n+/g, ' ').trim() || undefined,
    address: venue.address,
    city: homeTown,
    postcode: venue.postcode,
    phone: venue.phone,
    website: venue.website,
    lat: venue.lat,
    lng: venue.lng,
    // Structured hours if held, else the Google hours text parsed to a full week.
    openingHours: weekHoursForSchema(parseWeekHours(venue)) ?? undefined,
    priceFrom: venue.price_from,
    priceTo: venue.price_to,
    // AggregateRating only from reviews left on this site (shown in the Reviews
    // section). The Google Maps rating in the header is third-party data: it stays
    // visible (labelled "Google reviews") but is not put in structured data.
    avgRating: reviews.length > 0 ? avgRating : undefined,
    reviewCount: reviews.length > 0 ? reviews.length : undefined,
    reviews: reviews.length > 0
      ? reviews.slice(0, 10).map((review) => ({
          reviewerName: review.reviewer_name,
          rating: review.rating,
          comment: review.comment,
          datePublished: review.created_at,
        }))
      : undefined,
    imageUrl: galleryPhotos.length > 0 ? galleryPhotos[0].url : undefined,
    citySlug: city,
    venueSlug: slug,
    venueType: venue.venue_type,
  })

  // Breadcrumb schema – uses reusable builder
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: baseUrl },
    ...(guideHub ? [{ name: 'Soft Play', url: `${baseUrl}/soft-play` }] : []),
    { name: guideHub ? cityName : `Soft Play in ${cityName}`, url: `${baseUrl}/soft-play/${city}` },
    { name: venue.name, url: `${baseUrl}/soft-play/${city}/${slug}` },
  ])

  return (
    <>
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />
      <VenueViewTracking
        venueId={venue.id}
        citySlug={city}
        venueSlug={slug}
        plan={(venue as any).plan}
      />

      <div className="min-h-screen bg-slate-50">
        <Header backLink={{ href: `/soft-play/${city}`, label: cityName }} />

        <Breadcrumbs items={[
          ...(guideHub ? [{ label: 'Soft Play', href: '/soft-play' }] : county ? [{ label: county }] : []),
          { label: cityName, href: `/soft-play/${city}` },
          { label: venue.name },
        ]} />

        {/* Hero Section */}
        <div className="bg-gradient-to-b from-purple-600 to-purple-700 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-2">
                  {venue.featured && (
                    <Badge className="bg-yellow-400 text-yellow-900">Featured</Badge>
                  )}
                  {isVerified(venue) && (
                    <Badge className="bg-blue-500 text-white inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified by owner
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
                  {venue.name} <span className="text-purple-200 font-normal text-xl sm:text-2xl md:text-3xl">| Soft Play in {homeTown}</span>
                </h1>
                {!venue.claimed_by_owner && typeof venue.id === 'number' && venue.id > 0 && (
                  <p className="text-sm text-purple-100 mb-2">
                    Is this your venue?{' '}
                    <ClaimCta citySlug={city} slug={slug} placement="top" className="font-semibold text-white underline underline-offset-2">
                      Claim it free
                    </ClaimCta>
                  </p>
                )}
                {formatAddressLine(venue.address, venue.postcode) && (
                  <div className="flex items-center gap-2 text-purple-100">
                    <MapPin className="w-5 h-5" />
                    <address className="not-italic font-normal inline">{formatAddressLine(venue.address, venue.postcode)}</address>
                  </div>
                )}
                {avgRating > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${
                            i < Math.round(avgRating)
                              ? 'text-yellow-400 fill-current'
                              : 'text-purple-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="font-semibold">{avgRating.toFixed(1)}</span>
                    <span className="text-purple-200">
                      {reviews.length > 0
                        ? `(${reviews.length} reviews)`
                        : (venue as any).reviews_count
                          ? `(${(venue as any).reviews_count} Google reviews)`
                          : ''}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0">
                <CTAButtons
                  venueId={typeof venue.id === 'number' ? venue.id : undefined}
                  name={venue.name}
                  address={venue.address}
                  postcode={venue.postcode}
                  lat={venue.lat}
                  lng={venue.lng}
                  phone={venue.phone}
                  website={venue.website}
                  bookingUrl={venue.booking_url}
                  googlePlaceId={venue.google_place_id}
                  compact
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick facts: the same facts the meta description states (lib/venueSnippet.ts),
            so the snippet always matches what the page shows. */}
        {(factRows.length > 0 || compareLine) && (
          <section aria-labelledby="quick-facts-heading" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
            <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-5">
              <h2 id="quick-facts-heading" className="font-semibold text-base mb-3">Quick facts: {venue.name}</h2>
              {factRows.length > 0 && (
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  {factRows.map((r) => (
                    <div key={r.key} className="flex gap-2 min-w-0">
                      <dt className="text-slate-500 flex-shrink-0">{r.label}:</dt>
                      <dd className="font-medium text-slate-800 min-w-0">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {compareLine && (
                <a href="#nearby-soft-play" className="inline-block mt-3 text-sm font-medium text-purple-700 hover:text-purple-800">
                  {compareLine} &darr;
                </a>
              )}
            </div>
          </section>
        )}

        {/* Photo Gallery / Placeholder */}
        {galleryPhotos.length > 0 ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-10">
            <PhotoGallery photos={galleryPhotos} venueName={venue.name} />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center">
              <Camera className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="font-semibold text-slate-700 mb-2">No photos yet</p>
              <p className="text-sm text-slate-500 mb-4">
                Are you the owner of {venue.name}? Add photos to help families choose your venue.
              </p>
              <Button variant="outline" asChild>
                {venue.claimed_by_owner ? (
                  <Link href="/owner/login">Owner sign in to add photos</Link>
                ) : (
                  <ClaimCta citySlug={city} slug={slug} placement="photos">
                    Claim this listing to add photos
                  </ClaimCta>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Column */}
            <article className="lg:col-span-2 space-y-6">
              {/* Quick Facts Panel — structured summary with graceful fallbacks */}
              <QuickFactsPanel
                ageRangeMin={venue.age_range_min}
                ageRangeMax={venue.age_range_max}
                ageRanges={venue.age_ranges}
                acceptsWalkIns={undefined}
                prebookingRequired={venue.prebooking_required}
                priceFrom={venue.price_from}
                priceTo={venue.price_to}
                priceRange={venue.price_range}
                hasOpeningHours={hasOpeningHours(venue)}
                cafe={venue.cafe}
                parking={venue.parking}
                parties={venue.parties}
                toddlerArea={venue.toddler_area}
                babyArea={venue.baby_area}
                senFriendly={venue.sen_friendly}
                wheelchairAccess={venue.wheelchair_access}
                disabledAccess={venue.disabled_access}
              />

              {/* From the owner: only what a verified owner has added (venue_owner_data) */}
              {(() => {
                const o = venue._owner
                if (!o) return null
                const prices = priceLines(o.prices)
                const events = upcomingEvents(o.events)
                const rows: Array<[string, string]> = [
                  ...(prices.length ? [['Prices', prices.join(' · ') + (o.prices?.notes ? `. ${o.prices.notes}` : '')] as [string, string]] : []),
                  ...(o.toddler_sessions ? [['Toddler sessions', o.toddler_sessions] as [string, string]] : []),
                  ...(o.sen_sessions ? [['SEN and quiet sessions', o.sen_sessions] as [string, string]] : []),
                  ...(o.party_packages ? [['Parties', o.party_packages] as [string, string]] : []),
                ]
                if (!rows.length && !events.length) return null
                return (
                  <section aria-labelledby="owner-heading" className="bg-white rounded-lg border border-slate-200 p-6">
                    <h2 id="owner-heading" className="font-semibold text-lg mb-1">From {venue.name}</h2>
                    <p className="text-xs text-slate-500 mb-4">Added by the venue&apos;s verified owner.</p>
                    {rows.length > 0 && (
                      <dl className="space-y-3 text-sm">
                        {rows.map(([k, v]) => (
                          <div key={k}>
                            <dt className="font-medium text-slate-800">{k}</dt>
                            <dd className="text-slate-600 whitespace-pre-line">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {events.length > 0 && (
                      <div className="mt-4">
                        <h3 className="font-medium text-slate-800 mb-2">Coming up</h3>
                        <ul className="space-y-2 text-sm">
                          {events.map((e) => (
                            <li key={`${e.date}-${e.title}`}>
                              <time dateTime={e.date} className="font-medium">{new Date(`${e.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</time>
                              {' '}{e.title}{e.description ? `: ${e.description}` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                )
              })()}

              {/* About – always shown; renders stored multi-paragraph description */}
              <section aria-labelledby="about-heading" className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 id="about-heading" className="font-semibold text-lg mb-3">About {venue.name}</h2>
                <div className="space-y-3">
                  {displayDescription.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="text-slate-600 leading-relaxed">{para}</p>
                  ))}
                </div>
                {!cleanedDescription && (
                  <p className="mt-3 text-xs text-slate-400 italic">
                    This description was generated from available listing data. Contact the venue to confirm details.
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">
                    Is this information correct?{' '}
                    <a
                      href={`mailto:info@softplaynearme.co.uk?subject=Update%20for%20${encodeURIComponent(venue.name)}`}
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      Send us updates
                    </a>
                  </p>
                  {venue.last_verified_at && (
                    <p className="text-xs text-slate-400">
                      Last updated:{' '}
                      {new Date(venue.last_verified_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </section>

              {/* Facilities Grid – showEmptyState ensures something renders */}
              <section aria-label="Facilities & Features">
                <FacilitiesGrid
                  facilities={venue.facilities}
                  cafe={venue.cafe}
                  parking={venue.parking}
                  parties={venue.parties}
                  toddlerArea={venue.toddler_area}
                  babyArea={venue.baby_area}
                  senFriendly={venue.sen_friendly}
                  wheelchairAccess={venue.wheelchair_access}
                  freeWifi={venue.free_wifi}
                  showEmptyState
                />
              </section>

              {/* "at a Glance" (removed 25 Nov 2026): it repeated the facilities grid and showed
                  every unconfirmed facility as "Not available", because the columns default to false. */}

              {/* Who is this best for: audience tags and any venue-specific line from
                  what_to_expect; the generic "children of all ages" text is dropped (lib/venueCopy.ts). */}
              {(() => {
                const audiences = expect.audiences.length ? expect.audiences : [
                  ...(venue.baby_area || venue.has_under_1s ? ['Babies'] : []),
                  ...(venue.toddler_area ? ['Toddlers'] : []),
                  ...(venue.parties ? ['Birthday parties'] : []),
                  ...(venue.sen_friendly || venue.has_sen_sessions ? ['SEN and additional needs'] : []),
                ]
                if (!audiences.length && !expect.body) return null
                return (
                  <div className="bg-purple-50 rounded-lg border border-purple-200 p-6">
                    <h2 className="font-semibold text-lg text-purple-900 mb-3">Who Is This Best For?</h2>
                    {audiences.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {audiences.map((a) => (
                          <span key={a} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                    {expect.body && <p className="text-slate-600 leading-relaxed text-sm">{expect.body}</p>}
                  </div>
                )
              })()}

              {/* Tips: venue-specific ones only (the five generic tips were on ~1,500 pages) */}
              {tips && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-3">Tips Before You Visit</h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {tips}
                  </p>
                </div>
              )}

              {/* Session Info (only when data present) */}
              {venue.session_info && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-3">Sessions</h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {venue.session_info}
                  </p>
                </div>
              )}

              {/* Peak Times (only when data present) */}
              {venue.peak_times && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-3">Peak Times</h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {venue.peak_times}
                  </p>
                </div>
              )}

              {/* Special Sessions */}
              {sessions.length > 0 && <SpecialSessions sessions={sessions} />}

              <ReviewSection
                initialReviews={reviews}
                venueId={venue.id}
                citySlug={city}
                venueSlug={slug}
                googleReviewCount={(venue as any).reviews_count}
              />

              {/* Every other soft play within 5 miles: the list the meta's "Compare N" counts */}
              {withinVenues.length > 0 && (
                <section id="nearby-soft-play" aria-labelledby="nearby-soft-play-heading" className="bg-white rounded-lg border border-slate-200 p-6 scroll-mt-20">
                  <h2 id="nearby-soft-play-heading" className="font-semibold text-lg mb-1">
                    {facts.nearbyMore ? `${facts.nearbyCount}+` : facts.nearbyCount} other soft play{facts.nearbyCount === 1 && !facts.nearbyMore ? '' : 's'} near {homeTown}
                  </h2>
                  <p className="text-sm text-slate-500 mb-4">
                    {facts.nearbyMore ? `The ${facts.nearbyCount} closest` : 'All'} within {NEARBY_MILES} miles of {venue.name}, nearest first.
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {withinVenues.map((nv) => (
                      <li key={`${nv.citySlug}/${nv.slug}`}>
                        <Link
                          href={`/soft-play/${nv.citySlug}/${nv.slug}`}
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{nv.name}</p>
                            <p className="text-xs text-slate-500">{[nv.area, `${formatDistance(nv.miles)} away`].filter(Boolean).join(' · ')}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/soft-play/${city}`}
                    className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium mt-4"
                  >
                    All soft play in {cityName}
                  </Link>
                </section>
              )}

              {/* Closest soft play by distance, across hub boundaries (hubs with a guide) */}
              {withinVenues.length === 0 && guideHub && nearestVenues.length > 0 && (
                <section aria-labelledby="nearest-heading" className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 id="nearest-heading" className="font-semibold text-lg mb-4">More soft play near {venue.name}</h2>
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {nearestVenues.map((nv) => (
                      <li key={`${nv.citySlug}/${nv.slug}`}>
                        <Link
                          href={`/soft-play/${nv.citySlug}/${nv.slug}`}
                          className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{nv.name}</p>
                            <p className="text-xs text-slate-500">{[nv.area, `${formatDistance(nv.miles)} away`].filter(Boolean).join(' · ')}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/soft-play/${city}`}
                    className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium mt-4"
                  >
                    All soft play in {cityName}
                  </Link>
                </section>
              )}

              {/* Nearby Venues */}
              {withinVenues.length === 0 && !guideHub && nearbyVenues.length > 0 && (
                <section aria-labelledby="nearby-heading" className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 id="nearby-heading" className="font-semibold text-lg mb-4">Nearby Soft Play in {cityName}</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {nearbyVenues.map((nv) => (
                      <Link
                        key={nv.slug}
                        href={`/soft-play/${city}/${nv.slug}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{nv.name}</p>
                          <p className="text-xs text-slate-500">{nv.postcode}</p>
                        </div>
                        <Navigation className="w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                  <Link
                    href={`/soft-play/${city}`}
                    className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium mt-4"
                  >
                    View all venues in {cityName}
                  </Link>
                </section>
              )}

              {/* Similar Venues by Tag */}
              {similarVenues.length >= 2 && similarFeatureLabel && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-4">
                    More {similarFeatureLabel} Soft Play in {cityName}
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {similarVenues.map((sv) => {
                      const matchedTags = [
                        sv.toddler_area && venue.toddler_area ? 'Toddler' : null,
                        sv.sen_friendly && venue.sen_friendly ? 'SEN' : null,
                        sv.parties && venue.parties ? 'Parties' : null,
                      ].filter(Boolean)
                      return (
                        <Link
                          key={sv.slug}
                          href={`/soft-play/${city}/${sv.slug}`}
                          className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{sv.name}</p>
                            <p className="text-xs text-slate-500 mb-1">{sv.postcode}</p>
                            <div className="flex flex-wrap gap-1">
                              {matchedTags.map(tag => (
                                <span key={tag} className="text-xs bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                  <Link
                    href={`/soft-play/${city}/${venueTags.toddler_area ? 'toddler' : venueTags.sen_friendly ? 'sen-friendly' : 'birthday-parties'}`}
                    className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium mt-4"
                  >
                    View all {similarFeatureLabel.toLowerCase()} venues in {cityName} →
                  </Link>
                </div>
              )}

              {relatedCities.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 className="font-semibold text-lg mb-4">Explore Nearby Cities</h2>
                  <div className="flex flex-wrap gap-2">
                    {relatedCities.map((relatedCity) => (
                      <Link
                        key={relatedCity.slug}
                        href={`/soft-play/${relatedCity.slug}`}
                        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                      >
                        Soft Play in {relatedCity.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQ Section */}
              {faqs.length > 0 && (
                <section aria-labelledby="faq-heading" className="bg-white rounded-lg border border-slate-200 p-6">
                  <h2 id="faq-heading" className="font-semibold text-lg mb-4">
                    Frequently Asked Questions about {venue.name}
                  </h2>
                  <dl className="space-y-4">
                    {faqs.map((faq, i) => (
                      <div key={i} className="border-b border-slate-100 last:border-0 pb-4 last:pb-0">
                        <dt className="font-medium text-slate-800 mb-1">{faq.question}</dt>
                        <dd className="text-sm text-slate-600 leading-relaxed">{faq.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {/* Venue Owner Section (unclaimed listings only) */}
              {!venue.claimed_by_owner && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
                <h2 className="font-semibold text-lg text-green-800 mb-3">
                  Venue Owners: Manage Your Listing
                </h2>
                <p className="text-sm text-green-700 mb-4">
                  Soft Play Near Me helps thousands of parents find venues like yours every month.
                  Claim your free listing to:
                </p>
                <ul className="text-sm text-green-700 space-y-2 mb-4">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Update opening hours and pricing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Add photos and descriptions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Highlight special sessions (SEN, toddler, parties)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    Respond to reviews
                  </li>
                </ul>
                <Button asChild className="bg-green-600 hover:bg-green-700">
                  <ClaimCta citySlug={city} slug={slug} placement="owner-section">
                    Claim Your Free Listing
                  </ClaimCta>
                </Button>
              </div>
              )}
            </article>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Map */}
                <VenueMap
                  name={venue.name}
                  address={venue.address}
                  postcode={venue.postcode}
                  lat={venue.lat ?? null}
                  lng={venue.lng ?? null}
                  googlePlaceId={venue.google_place_id}
                />

                {/* CTA Buttons (full version for sidebar) */}
                <CTAButtons
                  venueId={typeof venue.id === 'number' ? venue.id : undefined}
                  name={venue.name}
                  address={venue.address}
                  postcode={venue.postcode}
                  lat={venue.lat}
                  lng={venue.lng}
                  phone={venue.phone}
                  website={venue.website}
                  bookingUrl={venue.booking_url}
                  googlePlaceId={venue.google_place_id}
                />

                {/* Enquiry form — only for venues that exist in our DB (have a real id) */}
                {typeof venue.id === 'number' && (
                  <EnquiryForm venueId={venue.id} venueName={venue.name} />
                )}

                {typeof venue.id === 'number' && (
                  <div className="flex justify-center">
                    <ReportIssueLink venueId={venue.id} />
                  </div>
                )}

                {/* Pricing */}
                <PricingTable
                  pricing={pricing}
                  priceFrom={venue.price_from}
                  priceTo={venue.price_to}
                  showEmptyState
                />

                {/* Opening Hours */}
                {hoursTable ? (
                  <OpeningHours hours={hoursTable} />
                ) : cleanHoursText(venue.opening_hours_text) ? (
                  // No structured hours, but we do hold the venue's listed hours as
                  // text — show them as listed rather than claiming nothing is known.
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5 text-purple-600" />
                        Opening Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {cleanHoursText(venue.opening_hours_text)
                          .split(/\s*[|;]\s*/)
                          .filter(Boolean)
                          .map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                      </ul>
                      <p className="mt-3 text-xs text-slate-500">
                        Hours as listed for {venue.name} &mdash; confirm with the venue before travelling, especially in school holidays.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="h-5 w-5 text-purple-600" />
                        Opening Hours
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-500 mb-3">
                        Opening hours not confirmed &mdash; check {venue.name}&apos;s
                        {venue.website ? (
                          <>
                            {' '}
                            <a
                              href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:text-purple-700 underline"
                            >
                              own website
                            </a>
                          </>
                        ) : (
                          ' own website'
                        )}{' '}
                        or Facebook page before visiting.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {venue.phone && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`tel:${venue.phone.replace(/\s/g, '')}`}>
                              <Phone className="h-4 w-4" />
                              Call to Check
                            </a>
                          </Button>
                        )}
                        {typeof venue.id === 'number' && (
                          <Button variant="outline" size="sm" asChild>
                            <ClaimCta citySlug={city} slug={slug} placement="hours-card">
                              Know the hours? Update this listing
                            </ClaimCta>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Claim Venue CTA (unclaimed listings only) */}
                {!venue.claimed_by_owner && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-green-800">Own this venue?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-green-700">
                      Claim your free listing to update information, add photos,
                      and manage your venue profile.
                    </p>
                    <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                      <ClaimCta citySlug={city} slug={slug} placement="sidebar">
                        Claim This Venue (Free)
                      </ClaimCta>
                    </Button>
                    <p className="text-xs text-green-600 text-center">
                      No cost, no obligation
                    </p>
                  </CardContent>
                </Card>
                )}
              </div>
            </div>
          </div>

          <AdSlot placement="venue_page" city={city} className="max-w-4xl mx-auto px-4 pb-10" />

          <div className="max-w-2xl mx-auto px-4 pb-12">
            <NewsletterSignup
              source="venue_page"
              offer="both"
              heading="Never miss a new soft play venue"
              subtext={`Get new venue alerts for ${cityName} and weekly family day-out ideas.`}
            />
          </div>
        </main>

        <Footer />
      </div>
    </>
  )
}
