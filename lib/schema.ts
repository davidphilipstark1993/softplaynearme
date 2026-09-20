/**
 * Reusable Schema.org structured data builders for SEO.
 *
 * Generates JSON-LD objects that can be injected into any page via
 * <script type="application/ld+json">.
 */

import { cleanAddressForDisplay } from './sanitize'

// ── Day-name map for Schema.org openingHoursSpecification ──────────────
const SCHEMA_DAYS: Record<string, string> = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday',
}

/**
 * Parse a human-readable hours string like "9:00am - 6:00pm" or "09:00 - 18:00"
 * into { opens: "09:00", closes: "18:00" } (24-hour ISO format).
 * Returns null for "Closed" or unparseable strings.
 */
function parseHoursString(raw: string | { open: string; close: string }): { opens: string; closes: string } | null {
  // Handle object format from database: { open: "09:30", close: "17:00" }
  if (typeof raw === 'object' && raw !== null && 'open' in raw && 'close' in raw) {
    if (raw.open === 'closed' || raw.close === 'closed') return null
    const pad = (s: string) => s.padStart(5, '0') // ensure "9:00" → "09:00"
    return { opens: pad(raw.open), closes: pad(raw.close) }
  }

  if (!raw || typeof raw !== 'string') return null
  if (raw.toLowerCase() === 'closed') return null

  const match = raw.match(
    /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–]\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/i
  )
  if (!match) return null

  let openH = parseInt(match[1], 10)
  const openM = parseInt(match[2] || '0', 10)
  const openP = match[3]?.toLowerCase()

  let closeH = parseInt(match[4], 10)
  const closeM = parseInt(match[5] || '0', 10)
  const closeP = match[6]?.toLowerCase()

  if (openP === 'pm' && openH !== 12) openH += 12
  if (openP === 'am' && openH === 12) openH = 0
  if (closeP === 'pm' && closeH !== 12) closeH += 12
  if (closeP === 'am' && closeH === 12) closeH = 0

  const pad = (n: number) => n.toString().padStart(2, '0')
  return {
    opens: `${pad(openH)}:${pad(openM)}`,
    closes: `${pad(closeH)}:${pad(closeM)}`,
  }
}

// ── Schema.org @type selection ──────────────────────────────────────────

/**
 * Map our internal venue_type (lib/venueTypes.ts) to the closest valid
 * Schema.org LocalBusiness subtype. Previously every venue used
 * 'SportsActivityLocation' regardless of category — technically valid (it's
 * a real schema.org type) but a poor semantic fit for an indoor soft play
 * centre, which isn't a sports facility. 'EntertainmentBusiness' is the
 * closest official type for a family/children's entertainment venue with no
 * schema.org type of its own (there is no dedicated "soft play" or
 * "playground business" type). The non-soft-play categories get their own
 * closer fit: a trampoline park genuinely is a sports/physical-activity
 * venue, a play farm or family attraction is best described as a tourist
 * attraction, and a park playground is literally a Schema.org Park.
 */
function getSchemaType(venueType: string | null | undefined): string {
  switch (venueType) {
    case 'trampoline-park':
      return 'SportsActivityLocation'
    case 'play-farm':
    case 'family-attraction':
      return 'TouristAttraction'
    case 'park-playground':
      return 'Park'
    default: // 'indoor', 'pub', null/undefined — genuine soft play centres
      return 'EntertainmentBusiness'
  }
}

// ── Public interfaces ──────────────────────────────────────────────────

export interface LocalBusinessReviewInput {
  reviewerName: string
  rating: number
  comment: string
  datePublished: string
}

export interface LocalBusinessSchemaInput {
  name: string
  description?: string
  address: string | null
  city: string
  postcode: string
  phone?: string
  website?: string
  lat?: number
  lng?: number
  openingHours?: Record<string, string | { open: string; close: string }> | null
  priceFrom?: number
  priceTo?: number
  avgRating?: number
  reviewCount?: number
  reviews?: LocalBusinessReviewInput[]
  imageUrl?: string
  citySlug: string
  venueSlug: string
  venueType?: string | null
}

/**
 * Build a complete Schema.org LocalBusiness / SportsActivityLocation
 * JSON-LD object from venue data.
 *
 * Usage:
 *   const schema = buildLocalBusinessSchema({ ...venue data })
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
 *   />
 */
export function buildLocalBusinessSchema(input: LocalBusinessSchemaInput) {
  const venueUrl = `https://www.softplaynearme.co.uk/soft-play/${input.citySlug}/${input.venueSlug}`

  // Build openingHoursSpecification from the hours map
  const openingHoursSpec: any[] = []
  if (input.openingHours) {
    for (const [day, raw] of Object.entries(input.openingHours)) {
      const schemaDay = SCHEMA_DAYS[day.toLowerCase()]
      if (!schemaDay) continue

      const parsed = parseHoursString(raw)
      if (parsed) {
        openingHoursSpec.push({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: schemaDay,
          opens: parsed.opens,
          closes: parsed.closes,
        })
      }
    }
  }

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': getSchemaType(input.venueType),
    '@id': `${venueUrl}#business`,
    name: input.name,
    url: venueUrl,
    address: {
      '@type': 'PostalAddress',
      // Omit streetAddress rather than assert leaked scrape junk ("nan",
      // "Closed, · Opens 9am") as a stated fact — same principle as the
      // postalCode omission below.
      ...(cleanAddressForDisplay(input.address) ? { streetAddress: cleanAddressForDisplay(input.address)! } : {}),
      addressLocality: input.city,
      // Omit rather than emit `postalCode: ""` — an empty string is a stated
      // blank value in JSON-LD, which validators flag; absent is correct.
      ...(input.postcode ? { postalCode: input.postcode } : {}),
      addressCountry: 'GB',
    },
    publisher: {
      '@id': 'https://www.softplaynearme.co.uk/#organization',
    },
  }

  if (input.description) {
    schema.description = input.description
  }

  if (input.phone) {
    schema.telephone = input.phone
  }

  if (input.website) {
    schema.sameAs = [input.website]
  }

  if (input.lat && input.lng) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.lat,
      longitude: input.lng,
    }
  }

  if (openingHoursSpec.length > 0) {
    schema.openingHoursSpecification = openingHoursSpec
  }

  if (input.priceFrom) {
    schema.priceRange = input.priceTo
      ? `\u00A3${input.priceFrom} - \u00A3${input.priceTo}`
      : `From \u00A3${input.priceFrom}`
  }

  if (input.avgRating && input.reviewCount && input.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.avgRating.toFixed(1),
      reviewCount: input.reviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  if (input.reviews && input.reviews.length > 0) {
    schema.review = input.reviews.slice(0, 10).map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.reviewerName,
      },
      datePublished: review.datePublished,
      reviewBody: review.comment,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }))
  }

  if (input.imageUrl) {
    schema.image = input.imageUrl
  }

  return schema
}

// ── Breadcrumb schema builder ──────────────────────────────────────────

export interface BreadcrumbSchemaItem {
  name: string
  url?: string
}

/**
 * Build a Schema.org BreadcrumbList JSON-LD object.
 *
 * Usage:
 *   const schema = buildBreadcrumbSchema([
 *     { name: 'Home', url: 'https://www.softplaynearme.co.uk' },
 *     { name: 'Hull', url: 'https://www.softplaynearme.co.uk/soft-play/hull' },
 *     { name: 'Venue Name' },
 *   ])
 */
export function buildBreadcrumbSchema(items: BreadcrumbSchemaItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url && { item: item.url }),
    })),
  }
}

// ── FAQ schema builder ─────────────────────────────────────────────────

export interface FAQItem {
  question: string
  answer: string
}

/**
 * Build a Schema.org FAQPage JSON-LD object.
 * Returns null if the list is empty.
 */
export function buildFAQSchema(faqs: FAQItem[]) {
  if (faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

// ── Article / BlogPosting schema builder ──────────────────────────────

export interface ArticleSchemaInput {
  title: string
  description: string
  slug: string
  datePublished: string
  dateModified: string
  imageUrl?: string
}

/**
 * Build a Schema.org BlogPosting JSON-LD object for blog posts.
 */
export function buildArticleSchema(input: ArticleSchemaInput) {
  const url = `https://www.softplaynearme.co.uk/blog/${input.slug}`
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: input.title,
    description: input.description,
    url,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: {
      '@type': 'Organization',
      '@id': 'https://www.softplaynearme.co.uk/#organization',
      name: 'Soft Play Near Me',
      url: 'https://www.softplaynearme.co.uk',
    },
    publisher: {
      '@id': 'https://www.softplaynearme.co.uk/#organization',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    ...(input.imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: input.imageUrl,
        width: 1200,
        height: 630,
      },
    }),
  }
}

// ── ItemList schema builder ────────────────────────────────────────────

export interface ItemListVenue {
  name: string
  slug: string
  citySlug: string
  address?: string | null
  postcode?: string
  avgRating?: number
  reviewCount?: number
  venueType?: string | null
}

/**
 * Build a Schema.org ItemList JSON-LD object for a list of venues.
 * Used on city/town pages to give Google structured listing data.
 * Embeds address and aggregateRating per item (when available) so
 * answer engines can extract venue facts without a second page fetch.
 */
export function buildItemListSchema(
  venues: ItemListVenue[],
  listName: string
) {
  if (venues.length === 0) return null

  const baseUrl = 'https://www.softplaynearme.co.uk'

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: venues.length,
    itemListElement: venues.map((venue, i) => {
      const url = `${baseUrl}/soft-play/${venue.citySlug}/${venue.slug}`
      const item: Record<string, any> = {
        '@type': 'ListItem',
        position: i + 1,
        name: venue.name,
        url,
        item: {
          '@type': getSchemaType(venue.venueType),
          '@id': `${url}#business`,
          name: venue.name,
          url,
          ...(cleanAddressForDisplay(venue.address) && {
            address: {
              '@type': 'PostalAddress',
              streetAddress: cleanAddressForDisplay(venue.address)!,
              ...(venue.postcode && { postalCode: venue.postcode }),
              addressCountry: 'GB',
            },
          }),
          ...(venue.avgRating && venue.reviewCount && venue.reviewCount > 0 && {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: venue.avgRating.toFixed(1),
              reviewCount: venue.reviewCount,
              bestRating: 5,
              worstRating: 1,
            },
          }),
        },
      }
      return item
    }),
  }
}

/**
 * Build a Schema.org ItemList JSON-LD object for a list of city hub pages.
 * Used on the homepage "Browse by City" section.
 */
export function buildCityListSchema(
  cities: { name: string; slug: string }[],
  listName: string
) {
  if (cities.length === 0) return null

  const baseUrl = 'https://www.softplaynearme.co.uk'

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    numberOfItems: cities.length,
    itemListElement: cities.map((city, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Soft Play in ${city.name}`,
      url: `${baseUrl}/soft-play/${city.slug}`,
    })),
  }
}

// ── CollectionPage schema builder ──────────────────────────────────────

export interface CollectionPageSchemaInput {
  name: string
  description?: string
  url: string
}

/**
 * Build a Schema.org CollectionPage JSON-LD object for hub pages (city
 * and filter subpages) that primarily exist to list an ItemList of venues.
 */
export function buildCollectionPageSchema(input: CollectionPageSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${input.url}#webpage`,
    name: input.name,
    url: input.url,
    ...(input.description && { description: input.description }),
    isPartOf: {
      '@id': 'https://www.softplaynearme.co.uk/#website',
    },
  }
}
