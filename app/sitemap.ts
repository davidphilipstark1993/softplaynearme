import { MetadataRoute } from 'next'
import { getAllCitySlugs, filters } from '@/lib/venues'
import { getPool } from '@/lib/pool'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.softplaynearme.co.uk'
  const cities = getAllCitySlugs()

  const sitemap: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  // Add city pages
  for (const city of cities) {
    sitemap.push({
      url: `${baseUrl}/soft-play/${city}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    })

    // Add filter pages for each city
    for (const filter of filters) {
      sitemap.push({
        url: `${baseUrl}/soft-play/${city}/${filter.slug}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      })
    }
  }

  // Add individual venue pages
  try {
    const pool = getPool()
    const client = await pool.connect()
    try {
      const result = await client.query('SELECT city_slug, slug, updated_at FROM venues')
      for (const venue of result.rows) {
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
  } catch (error) {
    console.error('Error fetching venues for sitemap:', error)
  }

  return sitemap
}
