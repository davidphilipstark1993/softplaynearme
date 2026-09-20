import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PreferencesForm } from './PreferencesForm'

export const metadata = {
  title: 'Email Preferences',
  robots: { index: false },
}

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main id="main-content" className="max-w-lg mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">Email preferences</h1>
        <p className="text-sm text-slate-500 mb-8 text-center">
          Choose which Soft Play Near Me emails you&rsquo;d like to receive.
        </p>
        {token ? (
          <PreferencesForm token={token} />
        ) : (
          <p className="text-center text-sm text-slate-500">Missing preferences link — please use the link from your email.</p>
        )}
      </main>
      <Footer minimal />
    </div>
  )
}
