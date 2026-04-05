import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CheckCircle2, Camera, Clock, PoundSterling, ListChecks, FileText, ArrowRight, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Listing Claimed | Soft Play Near Me',
  robots: { index: false, follow: false },
}

interface SuccessPageProps {
  searchParams: Promise<{ token?: string }>
}

const CHECKLIST = [
  {
    icon: Camera,
    title: 'Upload photos (3+ recommended)',
    desc: 'Listings with photos get 3× more clicks. Show parents your ball pit, café, and party rooms.',
    value: '+10%',
    color: 'text-blue-600 bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600',
    anchor: 'photos',
  },
  {
    icon: Clock,
    title: 'Set your opening hours',
    desc: 'Appear in "Open Now" searches and show parents exactly when you\'re open each day.',
    value: '+15%',
    color: 'text-amber-600 bg-amber-50 border-amber-100',
    iconColor: 'text-amber-600',
    anchor: 'hours',
  },
  {
    icon: PoundSterling,
    title: 'Add prices and session types',
    desc: 'Parents want to know the cost upfront. Add entry prices, toddler sessions, and party packages.',
    value: '+15%',
    color: 'text-green-600 bg-green-50 border-green-100',
    iconColor: 'text-green-600',
    anchor: 'pricing',
  },
  {
    icon: ListChecks,
    title: 'Select your facilities',
    desc: 'Café, free parking, SEN sessions, birthday parties — let parents filter to find you.',
    value: '+20%',
    color: 'text-purple-600 bg-purple-50 border-purple-100',
    iconColor: 'text-purple-600',
    anchor: 'facilities',
  },
  {
    icon: FileText,
    title: 'Write a venue description',
    desc: 'A friendly 2–3 sentence intro helps parents understand what you offer and who it\'s perfect for.',
    value: '+15%',
    color: 'text-pink-600 bg-pink-50 border-pink-100',
    iconColor: 'text-pink-600',
    anchor: 'description',
  },
]

const INITIAL_SCORE = 20

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const { token } = await searchParams
  const dashboardBase = token ? `/dashboard/${token}` : '/dashboard'

  const remaining = 100 - INITIAL_SCORE
  const progressWidth = `${INITIAL_SCORE}%`

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-12 sm:py-16">

        {/* Hero card */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 border-4 border-green-200 mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">You&apos;re in! 🎉</h1>
          <p className="text-slate-600 text-lg">
            Your claim is under review — we&apos;ll confirm within 2 working days.
            <br />
            <span className="text-slate-500 text-base">In the meantime, get your listing ready to go live.</span>
          </p>
          {token && (
            <p className="mt-4 text-sm text-slate-400 flex items-center justify-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              We&apos;ve emailed you a link to your dashboard — check your inbox.
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-900">Your listing is {INITIAL_SCORE}% complete</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Finish to rank higher in searches and get more parent visits
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-purple-600">{INITIAL_SCORE}%</span>
            </div>
          </div>

          {/* Bar */}
          <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
              style={{ width: progressWidth }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Basic info submitted</span>
            <span>{remaining}% remaining</span>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-3 mb-8">
          <h2 className="font-semibold text-slate-900 text-lg px-1">Complete these to rank higher:</h2>

          {CHECKLIST.map((item) => {
            const Icon = item.icon
            const href = token ? `${dashboardBase}#${item.anchor}` : dashboardBase

            return (
              <Link
                key={item.anchor}
                href={href}
                className="group flex items-start gap-4 bg-white rounded-xl border border-slate-200 p-5 hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${item.color}`}>
                  <Icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors">
                      {item.title}
                    </p>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {item.value}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all mt-1 flex-shrink-0" />
              </Link>
            )
          })}
        </div>

        {/* CTA to dashboard */}
        {token && (
          <div className="text-center">
            <Link
              href={dashboardBase}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold px-8 py-4 rounded-xl hover:from-purple-700 hover:to-pink-600 transition-all shadow-md hover:shadow-lg text-base"
            >
              Open My Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <p className="mt-3 text-xs text-slate-400">
              Bookmark your dashboard URL — it&apos;s also in your welcome email
            </p>
          </div>
        )}

        {!token && (
          <div className="text-center">
            <p className="text-sm text-slate-500">
              Check your email for your personal dashboard link.{' '}
              <a href="mailto:hello@softplaynearme.co.uk" className="text-purple-600 hover:underline">
                Need help? Contact us.
              </a>
            </p>
          </div>
        )}

      </main>
      <Footer />
    </div>
  )
}
