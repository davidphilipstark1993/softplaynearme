import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export const metadata = {
  title: 'Unsubscribed',
  robots: { index: false },
}

const SCOPE_LABEL: Record<string, string> = {
  weekly: 'the weekly newsletter',
  events: 'family events & offers',
  all: 'all Soft Play Near Me emails',
}

export default async function UnsubscribedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; scope?: string; token?: string }>
}) {
  const { status = 'ok', scope = 'all', token } = await searchParams
  const ok = status === 'ok'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-green-600" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">You&rsquo;ve been unsubscribed</h1>
            <p className="text-slate-500 mb-6">
              You won&rsquo;t receive {SCOPE_LABEL[scope] ?? 'those emails'} from Soft Play Near Me any more.
            </p>
            {token && (
              <Link
                href={`/newsletter/preferences?token=${token}`}
                className="text-sm text-purple-600 underline hover:text-purple-700"
              >
                Changed your mind? Manage your preferences
              </Link>
            )}
          </>
        ) : (
          <>
            <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Link not recognised</h1>
            <p className="text-slate-500 mb-6">
              This unsubscribe link is invalid or has expired. Email{' '}
              <a href="mailto:hello@softplaynearme.co.uk" className="text-purple-600 underline">
                hello@softplaynearme.co.uk
              </a>{' '}
              and we&rsquo;ll remove you manually.
            </p>
          </>
        )}
      </main>
      <Footer minimal />
    </div>
  )
}
