import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'
import { listSentNewsletters } from '@/lib/newsletter/db'

export const metadata: Metadata = {
  title: 'Newsletter',
  description: 'Past issues of the Soft Play Near Me newsletter — soft play picks, family activities and offers.',
  alternates: { canonical: 'https://www.softplaynearme.co.uk/newsletter' },
}

async function getSentIssues() {
  // Falls back to an empty archive during a static (no-DB) build — see lib/pool.ts
  // STATIC_BUILD — rather than failing the build. Real requests (dev/prod runtime)
  // always have DATABASE_URL and hit the database normally.
  try {
    return await listSentNewsletters()
  } catch {
    return []
  }
}

export default async function NewsletterArchivePage() {
  const issues = await getSentIssues()

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Newsletter</h1>
          <p className="text-purple-100">Past issues — soft play picks, family activities and offers</p>
        </div>
      </div>

      <main id="main-content" className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-10">
          <NewsletterSignup
            source="newsletter_archive_index"
            offer="both"
            heading="Get Sunday&rsquo;s family guide"
            subtext="Join our list for soft play picks and family days out, delivered straight to your inbox."
          />
        </div>

        {issues.length === 0 ? (
          <p className="text-center text-slate-400 py-12">No issues sent yet — check back soon.</p>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/newsletter/${issue.slug}`}
                className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                <p className="text-xs text-slate-400 mb-1">
                  {issue.issue_number ? `Issue #${issue.issue_number} · ` : ''}
                  {issue.sent_at ? new Date(issue.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                </p>
                <p className="font-semibold text-slate-900">{issue.subject}</p>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
