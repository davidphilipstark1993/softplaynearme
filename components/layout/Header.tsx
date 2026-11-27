import Link from 'next/link'
import Image from 'next/image'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  /** Optional back link - shows "Back to {label}" instead of nav links */
  backLink?: { href: string; label: string }
}

export function Header({ backLink }: HeaderProps) {
  return (
    <nav aria-label="Main navigation" className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/brand/logo-icon.png"
            alt=""
            width={30}
            height={40}
            className="h-9 w-auto"
            priority
          />
          <span className="font-bold text-base sm:text-xl text-purple-600 whitespace-nowrap">Soft Play Near Me</span>
        </Link>
        <div className="flex gap-1 sm:gap-4 min-w-0">
          {backLink ? (
            <Button asChild variant="ghost" size="sm" className="h-10 sm:h-8 sm:text-base min-w-0">
              <Link href={backLink.href}>
                <span className="truncate"><span className="hidden sm:inline">Back to </span>{backLink.label}</span>
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="h-10 sm:h-8">
                <Link href="/search" aria-label="Find soft play near you">
                  <Search className="size-5 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline">Find Soft Play</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/blog">Blog</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/pricing">Pricing</Link>
              </Button>
              <Button asChild size="sm" className="h-10 sm:h-8 bg-green-600 text-white hover:bg-green-700 font-semibold">
                <Link href="/pricing">
                  <span className="hidden sm:inline">Free Listing</span>
                  <span className="sm:hidden">List venue</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
