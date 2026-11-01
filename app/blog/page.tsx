import Link from 'next/link'
import type { Metadata } from 'next'
import { posts } from '@/lib/blogPosts'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Soft Play City Guides & Parent Tips',
  description: 'Honest soft play city guides and practical tips for parents: where to go, what to expect, and which centres suit toddlers, parties and SEN.',
  alternates: {
    canonical: 'https://www.softplaynearme.co.uk/blog',
  },
  openGraph: {
    title: 'Soft Play City Guides & Parent Tips | Soft Play Near Me',
    description: 'Honest soft play city guides and practical tips for parents: where to go, what to expect, and which centres suit toddlers, parties and SEN.',
    url: 'https://www.softplaynearme.co.uk/blog',
    type: 'website',
    siteName: 'Soft Play Near Me',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soft Play City Guides & Parent Tips | Soft Play Near Me',
    description: 'Honest soft play city guides and practical tips for parents: where to go, what to expect, and which centres suit toddlers, parties and SEN.',
    images: ['/opengraph-image'],
  },
}

export default function BlogIndexPage() {
  // Don't link out to guides we've asked Google not to index — app/sitemap.ts
  // already excludes them, and linking them anyway sends a mixed signal while
  // spending internal link equity on pages we've judged unfit.
  const listedPosts = posts.filter((post) => !post.noindex)

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Blog' }]} />

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Soft Play Blog</h1>
        <p className="mt-3 text-base text-slate-700 sm:text-lg">
          Local city guides and practical planning tips for families searching for the best soft play near them.
        </p>

        <div className="mt-10 space-y-4">
          {listedPosts.map((post) => (
            <article key={post.slug} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                <Link className="hover:text-blue-700 hover:underline" href={`/blog/${post.slug}`}>
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-slate-700">{post.excerpt}</p>
              <p className="mt-2 text-sm text-slate-500">
                Updated{' '}
                <time dateTime={post.updatedAt}>
                  {new Date(post.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </time>
              </p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:underline"
              >
                Read more
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <Link
            href="/search"
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Browse all soft play venues
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
