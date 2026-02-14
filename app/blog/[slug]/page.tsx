import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { postsBySlug } from '@/lib/blogPosts'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = postsBySlug[slug]

  if (!post) {
    return {
      title: 'Post Not Found | Soft Play Near Me',
      description: 'The requested blog post could not be found.',
    }
  }

  const title = `${post.title} | Soft Play Near Me`
  const description = post.description || post.excerpt
  const url = `https://www.softplaynearme.co.uk/blog/${post.slug}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'Soft Play Near Me',
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
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
  const post = postsBySlug[slug]

  if (!post) {
    notFound()
  }

  const postUrl = `https://www.softplaynearme.co.uk/blog/${post.slug}`
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    author: {
      '@type': 'Organization',
      name: 'Soft Play Near Me',
    },
    mainEntityOfPage: postUrl,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    description: post.description || post.excerpt,
  }

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-sm font-medium text-slate-600">Soft Play Near Me Blog</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{post.title}</h1>
        <p className="mt-4 text-lg text-slate-700">{post.excerpt}</p>

        <div
          className="prose prose-slate mt-10 max-w-none"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />

        <div className="mt-12 border-t border-slate-200 pt-6">
          <Link href="/blog" className="text-sm font-medium text-blue-700 hover:underline">
            Back to all blog posts
          </Link>
        </div>
      </article>
    </main>
  )
}
