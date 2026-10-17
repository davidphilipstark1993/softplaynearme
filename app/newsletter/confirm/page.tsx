import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ConfirmSubscription } from '@/components/newsletter/ConfirmSubscription'

export const metadata = {
  title: 'Confirm your subscription',
  robots: { index: false, follow: false },
}

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main id="main-content" className="max-w-lg mx-auto px-4 py-20 text-center">
        <ConfirmSubscription token={token} />
      </main>
      <Footer minimal />
    </div>
  )
}
