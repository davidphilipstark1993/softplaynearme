import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { BespokeEnquiryForm } from '@/components/forms/BespokeEnquiryForm'
import { CheckCircle2 } from 'lucide-react'

const TITLE = 'Bespoke Plan Enquiry'
const SOCIAL_TITLE = 'Bespoke Plan Enquiry | Soft Play Near Me'
const DESCRIPTION =
  'Tell us about your venue and what you need — priority placement, sponsored slots, multi-venue management — and we’ll put together a tailored Bespoke quote.'
const URL = 'https://www.softplaynearme.co.uk/pricing/bespoke'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: true },
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

const BENEFITS = [
  'Priority placement across multiple cities',
  'Homepage & sponsored ad slots',
  'Monthly performance report',
  'Dedicated support — talk to a real person',
]

export default function BespokePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Pricing', href: '/pricing' }, { label: 'Bespoke' }]} />

      <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-amber-100 text-sm font-semibold uppercase tracking-wider mb-3">
            Bespoke plan
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Tell Us What You Need
          </h1>
          <p className="text-amber-50 text-lg max-w-lg mx-auto">
            A few quick questions so we can put together a quote that actually fits your venue —
            we&apos;ll come back to you within 1 working day.
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-7 sm:p-9 mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Get a Bespoke quote</h2>
          <p className="text-slate-500 text-sm mb-6">
            Takes about 2 minutes. No commitment.
          </p>
          <BespokeEnquiryForm />
        </div>

        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6">
          <h3 className="font-semibold text-amber-900 mb-4">What Bespoke includes</h3>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span className="text-amber-800 text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  )
}
