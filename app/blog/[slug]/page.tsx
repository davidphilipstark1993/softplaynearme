import type { Metadata } from 'next'
import { cities } from '@/lib/venues'
import { trimMeta } from '@/lib/metaLength'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostBySlug, getRelatedPosts, posts } from '@/lib/blogPosts'
import { ShareButtons } from '@/components/social/ShareButtons'
import { buildArticleSchema, buildFAQSchema, buildBreadcrumbSchema } from '@/lib/schema'
import { getBlogOgImage } from '@/lib/cityImages'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { JsonLd } from '@/components/seo/JsonLd'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    // No suffix — the root layout's title template appends it. Never index a
    // not-found response, otherwise it inherits the root `index: true`.
    return {
      title: 'Post Not Found',
      description: 'The requested blog post could not be found.',
      robots: { index: false, follow: false },
    }
  }

  // The root layout already applies `template: "%s | Soft Play Near Me"`, so the
  // page title must NOT repeat the suffix — doing so rendered it twice. Social
  // cards don't go through the template, so they keep the suffix explicitly.
  const title = post.title
  const socialTitle = `${post.title} | Soft Play Near Me`
  const description = trimMeta(post.excerpt)
  const canonical = `https://www.softplaynearme.co.uk/blog/${post.slug}`
  const ogImage = getBlogOgImage(post.city)

  return {
    // Drop the " | Soft Play Near Me" template suffix when it would push the title past ~60 characters.
    title: title.length + ' | Soft Play Near Me'.length > 60 ? { absolute: title } : title,
    description,
    alternates: {
      canonical,
    },
    ...(post.noindex && { robots: { index: false, follow: true } }),
    openGraph: {
      title: socialTitle,
      description,
      url: canonical,
      type: 'article',
      siteName: 'Soft Play Near Me',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: [{ url: ogImage, width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      images: [ogImage],
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const canonical = `https://www.softplaynearme.co.uk/blog/${post.slug}`
  const ogImage = getBlogOgImage(post.city)
  const relatedPosts = getRelatedPosts(post.slug, post.city, 3)

  const articleSchema = buildArticleSchema({
    title: post.title,
    description: post.excerpt,
    slug: post.slug,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    imageUrl: ogImage,
  })

  const faqSchema = post.faq.length > 0
    ? buildFAQSchema(post.faq.map((f) => ({ question: f.q, answer: f.a })))
    : null

  // Guides that carry a venue table also publish it as an ItemList (first link in each table row).
  const listedVenues = [...post.contentHtml.matchAll(/<tr><td><a href="(\/soft-play\/[^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => ({
    name: m[2].replace(/&amp;/g, '&'),
    url: `https://www.softplaynearme.co.uk${m[1]}`,
  }))
  const itemListSchema = listedVenues.length >= 3
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: post.title,
        numberOfItems: listedVenues.length,
        itemListElement: listedVenues.map((v, i) => ({ '@type': 'ListItem', position: i + 1, name: v.name, url: v.url })),
      }
    : null
  const hubForPost = cities.find((c) => c.name.toLowerCase() === post.city.toLowerCase())

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', url: 'https://www.softplaynearme.co.uk' },
    { name: 'Blog', url: 'https://www.softplaynearme.co.uk/blog' },
    { name: post.title },
  ])

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Breadcrumbs items={[{ label: 'Blog', href: '/blog' }, { label: post.title }]} />

      <JsonLd data={breadcrumbSchema} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, '\\u003c') }}
      />
      {itemListSchema && <JsonLd data={itemListSchema} />}
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
        />
      )}

      <main id="main-content">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-slate-600">Soft Play Near Me Blog</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg text-slate-700">{post.excerpt}</p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>Published {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span>· Updated {new Date(post.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          {post.verifiedOn && <span>· By the Soft Play Near Me team, venue facts verified {post.verifiedOn}</span>}
        </div>

        <div className="mt-10">
          <article className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </div>

        <section className="mt-12 border-t border-slate-200 pt-8">
          <h2 className="text-2xl font-semibold text-slate-900">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-5">
            {post.faq.map((faq) => (
              <div key={faq.q}>
                <h3 className="text-lg font-semibold text-slate-900">{faq.q}</h3>
                <p className="mt-2 text-slate-700">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-slate-700">
          {hubForPost ? (
            <Link href={`/soft-play/${hubForPost.slug}`} className="font-semibold text-purple-700 hover:underline">
              See every soft play centre in {hubForPost.name} →
            </Link>
          ) : (
            <Link href="/soft-play" className="font-semibold text-purple-700 hover:underline">
              Browse soft play by town and city →
            </Link>
          )}
        </p>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <ShareButtons url={canonical} title={post.title} />
        </div>

        <div className="mt-8">
          <NewsletterSignup
            source="blog_article"
            heading="Find something fun to do with the kids"
            subtext="Get our weekly family activity picks and days-out ideas by email."
          />
        </div>

        {relatedPosts.length > 0 && (
          <section className="mt-12 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-5">More Parent Guides</h2>
            <div className="space-y-4">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group flex flex-col gap-1 rounded-lg border border-slate-200 p-4 hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-purple-700">{related.title}</span>
                  <span className="text-sm text-slate-500 line-clamp-1">{related.excerpt}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6">
          <Link href="/blog" className="text-sm font-medium text-purple-700 hover:underline">
            ← Back to all blog posts
          </Link>
        </div>
      </article>
      </main>

      <Footer />
    </div>
  )
}
