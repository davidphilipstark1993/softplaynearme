import { MetadataRoute } from 'next'
import { getAllCitySlugs, filters } from '@/lib/venues'
import { getPool } from '@/lib/pool'
import { getAllStaticTownSlugs, getStaticVenuesByTown } from '@/lib/staticVenues'
import { blogPosts } from '@/lib/blogPosts'
import redirectEntries from '@/data/redirects.json'
import { isDirectoryVenueType } from '@/lib/venueTypes'

// Paths that 301/308-redirect elsewhere (see next.config.ts) must never be
// listed in the sitemap even if a stale/duplicate row for them still exists
// in the venues table — submitting a URL that immediately redirects is the
// same mixed signal as submitting a noindex one.
const REDIRECTED_PATHS = new Set(redirectEntries.map((r) => r.source))

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.softplaynearme.co.uk'

  // Combine DB city slugs with static town slugs
  const dbCities = getAllCitySlugs()
  const staticTowns = getAllStaticTownSlugs()
  const allCities = [...new Set([...dbCities, ...staticTowns])]

  const sitemap: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/add-venue`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]

  for (const post of blogPosts) {
    // Skip noindexed guides for the same reason we skip thin venue pages below:
    // submitting a URL that carries a noindex directive is a mixed signal.
    if (post.noindex) continue

    sitemap.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.dateModified),
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  // Add city pages + filter pages
  for (const city of allCities) {
    sitemap.push({
      url: `${baseUrl}/soft-play/${city}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    })

    for (const filter of filters) {
      // /open-now pages are noindex,follow (their result set is time-of-day
      // dependent, so they're never a stable, indexable URL) — listing a
      // noindex URL in the sitemap is a mixed signal to Google, same reason
      // thin venue pages are excluded below.
      if (filter.slug === 'open-now') continue

      sitemap.push({
        url: `${baseUrl}/soft-play/${city}/${filter.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  }

  // Add individual venue pages from database
  // Exclude thin pages (completeness_score below noindex threshold) to avoid
  // submitting pages that carry a noindex directive — mixed signals for Google.
  const SITEMAP_MIN_SCORE = 20 // matches NOINDEX_THRESHOLD in lib/venueContent.ts
  const addedVenueSlugs = new Set<string>()
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      // completeness_score column may not exist on older DB instances; fall back
      // gracefully by computing a minimal inline score when it is missing.
      let result
      try {
        result = await client.query(`
          SELECT city_slug, slug, updated_at, completeness_score, venue_type
          FROM venues
          WHERE is_active = true
        `)
      } catch {
        // Column doesn't exist yet — include all venues without filtering
        result = await client.query(`
          SELECT city_slug, slug, updated_at, NULL::int AS completeness_score, NULL::text AS venue_type
          FROM venues
          WHERE is_active = true
        `)
      }

      for (const venue of result.rows) {
        const score = venue.completeness_score ?? 100 // unknown → include
        if (score < SITEMAP_MIN_SCORE) continue       // skip truly thin stubs
        if (!isDirectoryVenueType(venue.venue_type)) continue // non-soft-play: noindex, so not listed

        const path = `/soft-play/${venue.city_slug}/${venue.slug}`
        if (REDIRECTED_PATHS.has(path)) continue      // skip stale rows that just 301 elsewhere

        const key = `${venue.city_slug}/${venue.slug}`
        addedVenueSlugs.add(key)
        sitemap.push({
          url: `${baseUrl}${path}`,
          lastModified: venue.updated_at || new Date(),
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

  // Add venue pages from static data (if not already added from DB)
  for (const townSlug of staticTowns) {
    const venues = getStaticVenuesByTown(townSlug)
    for (const venue of venues) {
      if (!isDirectoryVenueType(venue.venueType)) continue // non-soft-play: noindex, so not listed
      const key = `${townSlug}/${venue.slug}`
      const path = `/soft-play/${townSlug}/${venue.slug}`
      if (!addedVenueSlugs.has(key) && !REDIRECTED_PATHS.has(path)) {
        sitemap.push({
          url: `${baseUrl}${path}`,
          // Use the venue's last-verified date so Google knows when data changed
          lastModified: venue.lastVerified ? new Date(venue.lastVerified) : new Date('2026-02-18'),
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      }
    }
  }

  return sitemap
}
