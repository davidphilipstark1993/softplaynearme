import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { RequestLinkForm } from '@/components/owner/RequestLinkForm'

export const metadata: Metadata = { title: 'Owner sign-in', robots: { index: false, follow: false } }

export default async function OwnerLogin({ searchParams }: { searchParams: Promise<{ expired?: string; error?: string }> }) {
  const { expired, error } = await searchParams
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sign in to your listing</h1>
        <p className="text-slate-600 mb-6">No password: we email you a link.</p>
        {expired && <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">That link has expired or has already been used. Request a new one below.</p>}
        {error && <p className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">Sign-in is not available right now. Please email hello@softplaynearme.co.uk.</p>}
        <div className="bg-white rounded-xl border border-slate-200 p-6"><RequestLinkForm /></div>
      </main>
      <Footer />
    </div>
  )
}
