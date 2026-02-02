import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl mb-4">🎈</div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Page Not Found</h1>
        <p className="text-slate-600 mb-8 max-w-md">
          Sorry, we couldn't find the page you're looking for. It might have been moved or doesn't exist.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button className="bg-purple-600 hover:bg-purple-700">Go Home</Button>
          </Link>
          <Link href="/soft-play/hull">
            <Button variant="outline">Browse Soft Play</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
