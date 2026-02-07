import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-purple-600 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Page Not Found</h2>
          <p className="text-slate-600 mb-8 max-w-md">
            Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/">
              <Button className="bg-purple-600 hover:bg-purple-700">Go Home</Button>
            </Link>
            <Link href="/search">
              <Button variant="outline">Search Venues</Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer minimal />
    </div>
  )
}
