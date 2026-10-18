import { MetadataRoute } from 'next'

const SITE = 'https://www.softplaynearme.co.uk'

// Private / non-content routes. Crawlers also get noindex on these pages as
// defence in depth.
const PRIVATE_PATHS = ['/api/', '/admin/', '/dashboard/', '/verify-email/']

/**
 * AI and answer-engine crawlers are welcome: the point of the directory is to be
 * found and quoted accurately. They are named explicitly (rather than only
 * covered by the `*` group) for two reasons: it states the intent, and a
 * crawler that finds a group naming it uses ONLY that group — so each named
 * group must repeat the private-path rules, or it would be told it can crawl
 * /admin/.
 *
 *   OpenAI      GPTBot (training), OAI-SearchBot (ChatGPT search index),
 *               ChatGPT-User (a user's request fetches a page)
 *   Anthropic   ClaudeBot (training), Claude-SearchBot (search index),
 *               Claude-User (a user's request fetches a page)
 *   Perplexity  PerplexityBot (index), Perplexity-User (a user's request)
 *   Google      Google-Extended (Gemini/AI training & grounding opt-in; no effect on Search)
 *   Apple       Applebot-Extended (Apple AI training opt-in)
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
