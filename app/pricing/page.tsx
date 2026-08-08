import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { CheckCircle2, X, Sparkles, Building2 } from 'lucide-react'

const TITLE = 'Pricing'
const SOCIAL_TITLE = 'Pricing | Soft Play Near Me'
const DESCRIPTION =
  'Basic listings are free forever on Soft Play Near Me. Upgrade to Premium or Bespoke for a Verified badge, featured placement, and lead notifications.'
const URL = 'https://www.softplaynearme.co.uk/pricing'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    siteName: 'Soft Play Near Me',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
}

const ROWS: { label: string; free: boolean | string; premium: boolean | string; bespoke: boolean | string }[] = [
  { label: 'Listed in search & city pages', free: true, premium: true, bespoke: true },
  { label: 'Address, hours, facilities, photos', free: true, premium: true, bespoke: true },
  { label: 'Claim & self-edit dashboard', free: true, premium: true, bespoke: true },
  { label: 'Verified badge', free: false, premium: true, bespoke: true },
  { label: 'Featured placement in your city', free: false, premium: true, bespoke: true },
  { label: 'Lead notifications by email', free: false, premium: true, bespoke: true },
  { label: 'Extra photos', free: false, premium: true, bespoke: true },
  { label: 'Priority in relevant filters', free: false, premium: true, bespoke: true },
  { label: 'Priority placement across multiple cities', free: false, premium: false, bespoke: true },
  { label: 'Homepage & sponsored ad slots', free: false, premium: false, bespoke: true },
  { label: 'Monthly performance report', free: false, premium: false, bespoke: true },
  { label: 'Dedicated support', free: false, premium: false, bespoke: true },
]

function Cell({ value }: { value: boolean | string }) {
  if (typeof value === 'string') return <span className="text-sm text-slate-700">{value}</span>
  return value ? (
    <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
  ) : (
    <X className="w-4 h-4 text-slate-300 mx-auto" />
  )
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Pricing' }]} />

      <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">Simple, honest pricing</h1>
          <p className="text-purple-100 text-lg max-w-xl mx-auto">
            Basic listings are free forever. Premium is optional — for venues that
            want extra visibility and leads from local parents.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10 sm:py-14">

        {/* Plan cards */}
        <div className="grid gap-6 sm:grid-cols-3 mb-12">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="font-bold text-lg text-slate-900 mb-1">Free</h2>
            <p className="text-3xl font-bold text-slate-900 mb-1">£0</p>
            <p className="text-sm text-slate-500 mb-5">forever</p>
            <Link
              href="/add-venue"
              className="block text-center bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              Claim your free listing
            </Link>
          </div>

          <div className="bg-white rounded-2xl border-2 border-purple-300 p-6 relative shadow-md">
            <span className="absolute -top-3 left-6 bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Most popular
            </span>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h2 className="font-bold text-lg text-slate-900">Premium</h2>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">£24.99<span className="text-base font-normal text-slate-400">/mo</span></p>
            <p className="text-sm text-slate-500 mb-5">or £249/year</p>
            <Link
              href="/add-venue"
              className="block text-center bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              Claim your venue to upgrade
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-lg text-slate-900">Bespoke</h2>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">From £59<span className="text-base font-normal text-slate-400">/mo</span></p>
            <p className="text-sm text-slate-500 mb-5">custom quote</p>
            <a
              href="mailto:david@softplaynearme.co.uk?subject=Bespoke%20plan%20enquiry"
              className="block text-center bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              Get a quote
            </a>
          </div>
        </div>

        {/* Comparison table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Feature</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Free</th>
                  <th className="px-4 py-3 text-center font-semibold text-purple-700">Premium</th>
                  <th className="px-4 py-3 text-center font-semibold text-amber-700">Bespoke</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-slate-700">{row.label}</td>
                    <td className="px-4 py-3 text-center"><Cell value={row.free} /></td>
                    <td className="px-4 py-3 text-center bg-purple-50/40"><Cell value={row.premium} /></td>
                    <td className="px-4 py-3 text-center"><Cell value={row.bespoke} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Already claimed your venue?{' '}
          <span className="text-slate-500">Log in from the link in your welcome email to upgrade.</span>
        </p>

      </main>
      <Footer />
    </div>
  )
}
