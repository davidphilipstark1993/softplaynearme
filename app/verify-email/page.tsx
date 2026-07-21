import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AlertCircle, CheckCircle2, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Verify Email | Soft Play Near Me',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { error } = await searchParams

  if (!error) {
    // No error param means the link was valid and the API handled the redirect.
    // This page only renders when something went wrong.
    return null
  }

  const isInvalid = error === 'invalid'
  const isMissing = error === 'missing'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          {isInvalid || isMissing ? (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 border-4 border-amber-200 mb-5">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-3">
                {isMissing ? 'Verification link missing' : 'Link expired or already used'}
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                {isMissing
                  ? 'This URL is missing the verification token. Please use the full link from your email.'
                  : 'This verification link has already been used or has expired. If your email is already verified, just open your dashboard.'}
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 border-4 border-red-200 mb-5">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-3">Something went wrong</h1>
              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                We couldn&apos;t process your verification right now. Please try the link again or contact us.
              </p>
            </>
          )}

          <div className="space-y-3">
            <a
              href="mailto:hello@softplaynearme.co.uk?subject=Resend%20verification%20email"
              className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              <Mail className="w-4 h-4" />
              Request a new verification email
            </a>
            <Link
              href="/"
              className="block text-sm text-slate-500 hover:text-slate-700 py-2"
            >
              Return to homepage
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          Already verified? Your dashboard link was in your welcome email.
        </div>
      </main>
      <Footer />
    </div>
  )
}
