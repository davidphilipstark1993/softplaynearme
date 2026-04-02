import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostBySlug, posts } from '@/lib/blogPosts'
import { ShareButtons } from '@/components/social/ShareButtons'

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
    return {
      title: 'Post Not Found | Soft Play Near Me',
      description: 'The requested blog post could not be found.',
    }
  }

  const title = `${post.title} | Soft Play Near Me`
  const description = post.excerpt
  const canonical = `https://softplaynearme.co.uk/blog/${post.slug}`

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'Soft Play Near Me',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/opengraph-image'],
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const canonical = `https://softplaynearme.co.uk/blog/${post.slug}`

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />

      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-slate-600">Soft Play Near Me Blog</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg text-slate-700">{post.excerpt}</p>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          <span>Published {new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span>· Updated {new Date(post.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
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

        <div className="mt-10 border-t border-slate-200 pt-6">
          <ShareButtons url={canonical} title={post.title} />
        </div>

        <div className="mt-6">
          <Link href="/blog" className="text-sm font-medium text-purple-700 hover:underline">
            ← Back to all blog posts
          </Link>
        </div>
      </article>
    </main>
  )
}
