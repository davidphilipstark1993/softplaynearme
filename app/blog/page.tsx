import Link from 'next/link'
import type { Metadata } from 'next'
import { blogPosts } from '@/lib/blogPosts'

export const metadata: Metadata = {
  title: 'Soft Play Blog',
  description: 'Guides, local ideas, and practical tips for finding great soft play centres across the UK.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Soft Play Blog | Soft Play Near Me',
    description: 'Guides, local ideas, and practical tips for finding great soft play centres across the UK.',
    url: 'https://www.softplaynearme.co.uk/blog',
    type: 'website',
    siteName: 'Soft Play Near Me',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soft Play Blog | Soft Play Near Me',
    description: 'Guides, local ideas, and practical tips for finding great soft play centres across the UK.',
    images: ['/opengraph-image'],
  },
}

export default function BlogIndexPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Soft Play Blog</h1>
        <p className="mt-3 text-base text-slate-700 sm:text-lg">
          Helpful guides for parents planning soft play days, birthday parties, and family activities.
        </p>

        <div className="mt-10 space-y-4">
          {blogPosts.map((post) => (
            <article key={post.slug} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                <Link className="hover:text-blue-700 hover:underline" href={`/blog/${post.slug}`}>
                  {post.title}
                </Link>
              </h2>
              <p className="mt-2 text-slate-700">{post.excerpt}</p>
              <Link
                href={`/blog/${post.slug}`}
                className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:underline"
              >
                Read article
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
