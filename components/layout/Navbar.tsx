'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'

interface NavbarProps {
  variant?: 'default' | 'transparent'
}

export function Navbar({ variant = 'default' }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const bgClass = variant === 'transparent'
    ? 'bg-transparent'
    : 'bg-white border-b border-slate-200'

  return (
    <nav className={`${bgClass} sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <span className="font-bold text-xl text-purple-600">Soft Play Near Me</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/search"
              className="text-slate-600 hover:text-purple-600 transition-colors font-medium"
            >
              Find Soft Play
            </Link>
            <Link
              href="/soft-play/hull"
              className="text-slate-600 hover:text-purple-600 transition-colors font-medium"
            >
              Hull
            </Link>
            <Link
              href="/soft-play/york"
              className="text-slate-600 hover:text-purple-600 transition-colors font-medium"
            >
              York
            </Link>
            <Link
              href="/soft-play/leeds"
              className="text-slate-600 hover:text-purple-600 transition-colors font-medium"
            >
              Leeds
            </Link>
            <Link href="/add-venue">
              <Button className="bg-purple-600 text-white hover:bg-purple-700">
                Add Venue
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-slate-600" />
            ) : (
              <Menu className="w-6 h-6 text-slate-600" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200">
            <div className="flex flex-col gap-2">
              <Link
                href="/search"
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Find Soft Play
              </Link>
              <Link
                href="/soft-play/hull"
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Hull
              </Link>
              <Link
                href="/soft-play/york"
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                York
              </Link>
              <Link
                href="/soft-play/leeds"
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Leeds
              </Link>
              <div className="px-4 pt-2">
                <Link href="/add-venue" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full bg-purple-600 text-white hover:bg-purple-700">
                    Add Venue
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
