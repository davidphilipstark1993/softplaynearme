import Link from 'next/link'
import { cities } from '@/lib/venues'

interface FooterProps {
  /** Minimal footer with just copyright (for detail pages) */
  minimal?: boolean
}

export function Footer({ minimal = false }: FooterProps) {
  if (minimal) {
    return (
      <footer className="bg-slate-900 text-slate-400 py-8 px-4 mt-12">
        <div className="max-w-7xl mx-auto text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Soft Play Near Me. All rights reserved.</p>
        </div>
      </footer>
    )
  }

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="font-bold text-lg text-white">Soft Play Near Me</span>
            </div>
            <p className="text-sm">Helping UK families find the best soft play centres since 2025.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Popular Cities</h4>
            <ul className="space-y-2 text-sm">
              {cities.slice(0, 6).map((city) => (
                <li key={city.slug}>
                  <Link href={`/soft-play/${city.slug}`} className="hover:text-white transition-colors">
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/search" className="hover:text-white transition-colors">Search Venues</Link></li>
              <li><Link href="/search?filters=toddler" className="hover:text-white transition-colors">Toddler Soft Play</Link></li>
              <li><Link href="/search?filters=parties" className="hover:text-white transition-colors">Birthday Parties</Link></li>
              <li><Link href="/search?filters=sen" className="hover:text-white transition-colors">SEN Friendly</Link></li>
              <li><Link href="/add-venue" className="hover:text-white transition-colors">Add Your Venue</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">About</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Soft Play Near Me. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
