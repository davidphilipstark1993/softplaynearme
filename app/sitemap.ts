import { MetadataRoute } from 'next'
import { getAllCitySlugs, filters } from '@/lib/venues'
import { getPool } from '@/lib/pool'
import { getAllStaticTownSlugs, getStaticVenuesByTown } from '@/lib/staticVenues'
import { blogPosts } from '@/lib/blogPosts'

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
  ]

  for (const post of blogPosts) {
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
      changeFrequency: 'daily',
      priority: 0.9,
    })

    for (const filter of filters) {
      sitemap.push({
        url: `${baseUrl}/soft-play/${city}/${filter.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }
  }

  // Add individual venue pages from database
  const addedVenueSlugs = new Set<string>()
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query('SELECT city_slug, slug, updated_at FROM venues')
      for (const venue of result.rows) {
        const key = `${venue.city_slug}/${venue.slug}`
        addedVenueSlugs.add(key)
        sitemap.push({
          url: `${baseUrl}/soft-play/${venue.city_slug}/${venue.slug}`,
          lastModified: venue.updated_at || new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
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
      const key = `${townSlug}/${venue.slug}`
      if (!addedVenueSlugs.has(key)) {
        sitemap.push({
          url: `${baseUrl}/soft-play/${townSlug}/${venue.slug}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      }
    }
  }

  return sitemap
}
