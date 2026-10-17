import { MetadataRoute } from 'next'
import { getAllCitySlugs, filters } from '@/lib/venues'
import { getPool } from '@/lib/pool'
import { getAllStaticTownSlugs, getStaticVenuesByTown } from '@/lib/staticVenues'
import { blogPosts } from '@/lib/blogPosts'
import redirectEntries from '@/data/redirects.json'
import { getVenueCounts } from '@/lib/venueCounts'
import { totalPagesFor, hubPagePath } from '@/lib/pagination'

// Paths that 301/308-redirect elsewhere (see next.config.ts) must never be
// listed in the sitemap even if a stale/duplicate row for them still exists
// in the venues table — submitting a URL that immediately redirects is the
// same mixed signal as submitting a noindex one.
const REDIRECTED_PATHS = new Set(redirectEntries.map((r) => r.source))

/** A usable Date, or undefined — never "now" as a stand-in for "unknown". */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined
  const d = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function later(a: Date | undefined, b: Date | undefined): Date | undefined {
  if (!a) return b
  if (!b) return a
  return a.getTime() >= b.getTime() ? a : b
}

/**
 * Every URL we want indexed, each with a lastmod that means something. A
 * sitemap whose lastmod is "now" on every fetch teaches Google to ignore it, so:
 *   venues         their own updated_at (DB) / last-verified date (static export)
 *   hubs, their    the most recent change among the hub's venues
 *     pages, filters
 *   blog posts     the post's dateModified
 *   homepage       the most recent change anywhere
 *   static pages   no lastmod (we don't track when they change)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.softplaynearme.co.uk'

  const dbCities = getAllCitySlugs()
  const staticTowns = getAllStaticTownSlugs()
  const allCities = [...new Set([...dbCities, ...staticTowns])]

  // ── Venues (DB first, then anything only in the static export) ──────────
  // Thin pages (completeness_score below the noindex threshold) are left out so
  // we never submit a URL that carries a noindex directive.
  const SITEMAP_MIN_SCORE = 20 // matches NOINDEX_THRESHOLD in lib/venueContent.ts
  const venueEntries: MetadataRoute.Sitemap = []
  const addedVenueKeys = new Set<string>()
  const cityLastMod = new Map<string, Date>()
  const bumpCity = (citySlug: string, d: Date | undefined) => {
    const merged = later(cityLastMod.get(citySlug), d)
    if (merged) cityLastMod.set(citySlug, merged)
  }

  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      // completeness_score column may not exist on older DB instances; fall back
      // gracefully by computing a minimal inline score when it is missing.
      let result
      try {
        result = await client.query(`
          SELECT city_slug, slug, updated_at, completeness_score
          FROM venues
          WHERE is_active = true
        `)
      } catch {
        // Column doesn't exist yet — include all venues without filtering
        result = await client.query(`
          SELECT city_slug, slug, updated_at, NULL::int AS completeness_score
          FROM venues
          WHERE is_active = true
        `)
      }

      for (const venue of result.rows) {
        const updated = toDate(venue.updated_at)
        bumpCity(venue.city_slug, updated)

        const score = venue.completeness_score ?? 100 // unknown → include
        if (score < SITEMAP_MIN_SCORE) continue       // skip truly thin stubs

        const path = `/soft-play/${venue.city_slug}/${venue.slug}`
        if (REDIRECTED_PATHS.has(path)) continue      // skip stale rows that just 301 elsewhere

        addedVenueKeys.add(`${venue.city_slug}/${venue.slug}`)
        venueEntries.push({
          url: `${baseUrl}${path}`,
          lastModified: updated,
          changeFrequency: 'weekly',
          priority: score >= 60 ? 0.8 : 0.6,
        })
      }
    } finally {
      client.release()
    }
  } catch {
    // DB unavailable - will use static data below
  }

  for (const townSlug of staticTowns) {
    for (const venue of getStaticVenuesByTown(townSlug)) {
      const verified = toDate(venue.lastVerified)
      bumpCity(townSlug, verified)

      const key = `${townSlug}/${venue.slug}`
      const path = `/soft-play/${townSlug}/${venue.slug}`
      if (!addedVenueKeys.has(key) && !REDIRECTED_PATHS.has(path)) {
        venueEntries.push({
          url: `${baseUrl}${path}`,
          // The venue's last-verified date, so Google knows when its data changed
          lastModified: verified,
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      }
    }
  }

  // ── Blog ────────────────────────────────────────────────────────────────
  const blogEntries: MetadataRoute.Sitemap = []
  let blogLastMod: Date | undefined
  for (const post of blogPosts) {
    // Skip noindexed guides for the same reason we skip thin venue pages:
    // submitting a URL that carries a noindex directive is a mixed signal.
    if (post.noindex) continue
    const modified = toDate(post.dateModified)
    blogLastMod = later(blogLastMod, modified)
    blogEntries.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: modified,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  // ── Hubs, their pages, and filter pages ─────────────────────────────────
  const counts = await getVenueCounts()
  const hubEntries: MetadataRoute.Sitemap = []
  let siteLastMod: Date | undefined
  for (const city of allCities) {
    const lastModified = cityLastMod.get(city)
    siteLastMod = later(siteLastMod, lastModified)

    hubEntries.push({
      url: `${baseUrl}/soft-play/${city}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    })

    // Pages 2+ of a hub's list are indexable (self-canonical), so they are listed.
    const pages = totalPagesFor(counts.byCity[city] ?? 0)
    for (let page = 2; page <= pages; page++) {
      hubEntries.push({
        url: `${baseUrl}${hubPagePath(city, page)}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.5,
      })
    }

    for (const filter of filters) {
      // /open-now pages are noindex,follow (their result set is time-of-day
      // dependent, so they're never a stable, indexable URL) — listing a
      // noindex URL in the sitemap is a mixed signal to Google, same reason
      // thin venue pages are excluded above.
      if (filter.slug === 'open-now') continue
      // A filter page with no matching venues is noindex too (see
      // components/filter/FilterPageContent.tsx) — same rule.
      const matching = counts.filterCountsByCity[city]?.[filter.slug as 'toddler' | 'birthday-parties' | 'sen-friendly'] ?? 0
      if (matching === 0) continue

      hubEntries.push({
        url: `${baseUrl}/soft-play/${city}/${filter.slug}`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  }

  // ── Top-level pages ─────────────────────────────────────────────────────
  const topLevel: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: siteLastMod, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/search`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/add-venue`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/blog`, lastModified: blogLastMod, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  return [...topLevel, ...blogEntries, ...hubEntries, ...venueEntries]
}
