import { cities, filters } from '@/lib/venues'
import { blogPosts } from '@/lib/blogPosts'
import { getVenueCounts } from '@/lib/venueCounts'
import { MIN_REVIEWS_FOR_TOP_RATED } from '@/lib/cityStats'
import { VENUES_PER_PAGE } from '@/lib/pagination'

// Rebuilt hourly from the same venue counts the site shows (lib/venueCounts.ts),
// so this file can't quote a different number from the homepage.
export const revalidate = 3600

const SITE = 'https://www.softplaynearme.co.uk'

/**
 * /llms.txt — a plain-text map of the site for language models and answer engines
 * (https://llmstxt.org): what the directory is, how far to trust each kind of
 * fact in it, and where the important pages are.
 *
 * TODO(owner): the "Where the data comes from" paragraph describes the process as
 * the codebase implements it (Google Places data + venue websites, owner claims,
 * per-listing verified dates). Check it matches how you actually verify venues
 * before relying on it.
 */
export async function GET() {
  const counts = await getVenueCounts()
  const hubs = cities
    .map((c) => ({ ...c, venues: counts.byCity[c.slug] ?? 0 }))
    .filter((c) => c.venues > 0)
    .sort((a, b) => b.venues - a.venues || a.name.localeCompare(b.name))

  const guides = blogPosts
    .filter((p) => !p.noindex)
    .sort((a, b) => new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime())
    .slice(0, 15)

  const dataFilters = filters.filter((f) => f.slug !== 'open-now')

  const lines = [
    '# Soft Play Near Me',
    '',
    `> A free directory of UK soft play centres: ${counts.total.toLocaleString('en-GB')} venues across ${hubs.length} towns and cities. Each listing shows the venue's address and contact details, facilities (toddler area, birthday parties, SEN-friendly, café, parking), visitor ratings, and — only where the venue has published them — opening hours and prices.`,
    '',
    '## Where the data comes from',
    '',
    "- Listings are compiled from public sources (Google Places data and venues' own websites). Venue owners can claim their listing for free to correct and extend it; claimed listings are marked Verified.",
    '- Every venue page shows the date it was last verified.',
    '- Missing information is shown as missing: if a page says hours or prices are not available, they are unknown — not zero, not closed. We do not estimate prices, opening hours or age ranges.',
    `- Ratings are visitor ratings with the number of reviews behind them. "Top rated" lists only include venues with ${MIN_REVIEWS_FOR_TOP_RATED} or more reviews.`,
    '- Counts on city pages are venues in that town; venues in surrounding towns are listed separately under "Soft play near …".',
    '',
    '## City pages',
    '',
    `Each city page lists its venues (${VENUES_PER_PAGE} per page), a summary built from the data, and an FAQ. URL pattern: ${SITE}/soft-play/{city}; individual venues are at ${SITE}/soft-play/{city}/{venue}.`,
    '',
    ...hubs.map((c) => `- [Soft play in ${c.name}](${SITE}/soft-play/${c.slug}): ${c.venues} ${c.venues === 1 ? 'venue' : 'venues'}, ${c.county}`),
    '',
    '## Filtered lists',
    '',
    `Every city has these lists at ${SITE}/soft-play/{city}/{filter}:`,
    '',
    ...dataFilters.map((f) => `- {city}/${f.slug}: ${f.name}`),
    '',
    '## Guides',
    '',
    ...guides.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.excerpt}`),
    `- [All guides](${SITE}/blog)`,
    '',
    '## Other',
    '',
    `- [Search by postcode](${SITE}/search)`,
    `- [Add or claim a venue](${SITE}/add-venue)`,
    `- [About](${SITE}/about)`,
    `- [Contact](${SITE}/contact)`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
