import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/search'],
      disallow: ['/api/', '/admin/', '/search?'],
    },
    sitemap: 'https://www.softplaynearme.co.uk/sitemap.xml',
  }
}
