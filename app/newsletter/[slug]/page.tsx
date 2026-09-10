import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'
import { getNewsletterBySlug, getNewsletterItems } from '@/lib/newsletter/db'
import type { NewsletterItem } from '@/lib/newsletter/types'

const BASE_URL = 'https://www.softplaynearme.co.uk'

const SECTION_META: Record<NewsletterItem['item_type'], string> = {
  venue: 'Featured soft play venues',
  event: 'Family events & activities',
  offer: 'Offers & discounts',
  news: 'Venue news',
  link: 'Useful for your week ahead',
}
const SECTION_ORDER: NewsletterItem['item_type'][] = ['venue', 'event', 'offer', 'news', 'link']

function itemUrl(item: NewsletterItem): string | null {
  if (item.item_type === 'venue' && item.venue_slug && item.city_slug) {
    return `/soft-play/${item.city_slug}/${item.venue_slug}`
  }
  return item.url || null
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const newsletter = await getNewsletterBySlug(slug)
  if (!newsletter) return {}

  const title = newsletter.subject
  const description = `Issue ${newsletter.issue_number ?? ''} of the Soft Play Near Me newsletter — soft play picks, family activities and offers.`.trim()
  return {
    title,
    description,
    alternates: { canonical: `${BASE_URL}/newsletter/${slug}` },
    openGraph: { title, description, url: `${BASE_URL}/newsletter/${slug}`, type: 'article' },
  }
}

export default async function NewsletterIssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const newsletter = await getNewsletterBySlug(slug)
  if (!newsletter) notFound()

  const items = await getNewsletterItems(newsletter.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-purple-100 text-xs font-semibold uppercase tracking-wide mb-2">
            {newsletter.type === 'weekly' ? 'Weekly newsletter' : 'Family events & offers'}
            {newsletter.issue_number ? ` · Issue #${newsletter.issue_number}` : ''}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold">{newsletter.subject}</h1>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {newsletter.intro_html && (
          <div className="prose prose-sm max-w-none mb-8 text-slate-700" dangerouslySetInnerHTML={{ __html: newsletter.intro_html }} />
        )}

        {SECTION_ORDER.map((type) => {
          const sectionItems = items.filter((i) => i.item_type === type)
          if (sectionItems.length === 0) return null
          return (
            <section key={type} className="mb-8">
              <h2 className="text-lg font-bold text-slate-900 mb-3">{SECTION_META[type]}</h2>
              <div className="space-y-3">
                {sectionItems.map((item) => {
                  const url = itemUrl(item)
                  const Content = (
                    <div className="bg-white border border-slate-200 rounded-xl p-4">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      {item.description && <p className="text-sm text-slate-600 mt-1">{item.description}</p>}
                      {url && <span className="text-sm text-purple-600 font-medium mt-2 inline-block">View more &rarr;</span>}
                    </div>
                  )
                  return url ? (
                    <Link key={item.id} href={url}>
                      {Content}
                    </Link>
                  ) : (
                    <div key={item.id}>{Content}</div>
                  )
                })}
              </div>
            </section>
          )
        })}

        <div className="mt-10">
          <NewsletterSignup
            source="newsletter_archive"
            offer="both"
            heading="Get this in your inbox every week"
            subtext="Join our list for soft play picks and family days out, delivered straight to your inbox."
          />
        </div>

        <div className="mt-8 text-center">
          <Link href="/newsletter" className="text-sm text-purple-600 hover:underline">
            &larr; Back to all newsletter issues
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
