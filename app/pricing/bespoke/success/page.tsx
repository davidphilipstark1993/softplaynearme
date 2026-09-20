import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CheckCircle2, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Enquiry Sent',
  robots: { index: false, follow: false },
}

export default function BespokeSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main id="main-content" className="max-w-xl mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 border-4 border-amber-200 mb-5">
          <CheckCircle2 className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Thanks — we&apos;ve got it 🎉</h1>
        <p className="text-slate-600 text-lg mb-6">
          We&apos;ll put together a tailored Bespoke quote and get back to you within 1 working day.
        </p>
        <p className="text-sm text-slate-400 flex items-center justify-center gap-1.5 mb-10">
          <Mail className="w-3.5 h-3.5" />
          Keep an eye on your inbox — reply directly to that email with any questions.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold px-8 py-4 rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all shadow-md hover:shadow-lg text-base"
        >
          Back to Soft Play Near Me
        </Link>
      </main>
      <Footer />
    </div>
  )
}
