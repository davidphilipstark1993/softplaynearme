import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // General crawlers (including AI/GEO crawlers — GPTBot, ClaudeBot,
        // Google-Extended, etc. — are intentionally allowed so AI answer
        // engines can retrieve and cite venue listings): allow all public
        // pages; block API, admin, and private token-based routes (noindex
        // is also set at page level for those as defense-in-depth).
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/dashboard/', '/verify-email/'],
      },
    ],
    sitemap: 'https://www.softplaynearme.co.uk/sitemap.xml',
  }
}
