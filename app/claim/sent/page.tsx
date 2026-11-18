import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = { title: 'Check your email', robots: { index: false, follow: false } }

export default async function ClaimSent({ searchParams }: { searchParams: Promise<{ method?: string; venue?: string }> }) {
  const { method, venue } = await searchParams
  const manual = method !== 'domain_email'
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Thanks: check your email</h1>
          <p className="text-slate-700 mb-3">We&apos;ve sent a sign-in link{venue ? ` for ${venue}` : ''}. It works once and expires in 24 hours.</p>
          {manual ? (
            <p className="text-slate-700">Because the address doesn&apos;t match the venue&apos;s website, we&apos;ll verify you by hand <strong>within 1 working day</strong>. Click the link to confirm your email; you&apos;ll be able to edit as soon as we&apos;ve checked.</p>
          ) : (
            <p className="text-slate-700">Your email matches the venue&apos;s website, so clicking the link verifies you straight away.</p>
          )}
          <p className="text-sm text-slate-500 mt-6">Nothing arrived? Check spam, or <Link href="/owner/login" className="underline">request a new link</Link>.</p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
