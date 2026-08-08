import Link from 'next/link'
import Image from 'next/image'
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
          <span className="font-bold text-xl text-purple-600">Soft Play Near Me</span>
        </Link>
        <div className="flex gap-2 sm:gap-4">
          {backLink ? (
            <Link href={backLink.href}>
              <Button variant="ghost" size="sm" className="sm:text-base">
                Back to {backLink.label}
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/search">
                <Button variant="ghost" size="sm">
                  <span className="hidden sm:inline">Find </span>Soft Play
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
              <Link href="/add-venue">
                <Button size="sm" className="bg-green-600 text-white hover:bg-green-700 font-semibold">
                  <span className="hidden sm:inline">Free </span>Listing
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
