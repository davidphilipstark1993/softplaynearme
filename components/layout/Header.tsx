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
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <Image
            src="/brand/logo-icon.png"
            alt=""
            width={30}
            height={40}
            className="h-8 sm:h-9 w-auto flex-shrink-0"
            priority
          />
          <span className="font-bold text-lg sm:text-xl text-purple-600 whitespace-nowrap">Soft Play Near Me</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
          {backLink ? (
            <Link href={backLink.href}>
              <Button variant="ghost" size="sm" className="sm:text-base">
                Back to {backLink.label}
              </Button>
            </Link>
          ) : (
            <>
              {/* Phones: an icon (a cut-down "Soft Play" label read as a heading, not a link) */}
              <Link href="/search" aria-label="Find soft play" className="sm:hidden">
                <Button variant="ghost" size="icon" tabIndex={-1} aria-hidden="true">
                  <Search className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/search" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Find Soft Play
                </Button>
              </Link>
              <Link href="/blog" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Blog
                </Button>
              </Link>
              <Link href="/pricing" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  Pricing
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="sm" className="bg-green-700 text-white hover:bg-green-800 font-semibold">
                  Free Listing
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
