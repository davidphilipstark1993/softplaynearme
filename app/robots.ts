import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // General crawlers: allow all public pages; block API, admin, and
        // search query-string variants (noindex is set at page level for those).
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
      {
        // Prevent AI training crawlers from scraping venue listings
        userAgent: ['GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Google-Extended'],
        disallow: '/',
      },
    ],
    sitemap: 'https://www.softplaynearme.co.uk/sitemap.xml',
  }
}
