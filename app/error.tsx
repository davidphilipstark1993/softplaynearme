'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Something went wrong</h1>
        <p className="text-slate-600 mb-6">
          Sorry about that. Please try again or go back to the homepage.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="bg-purple-600 hover:bg-purple-700">
            Try again
          </Button>
          <Button variant="outline" asChild>
            <a href="/">Go home</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
