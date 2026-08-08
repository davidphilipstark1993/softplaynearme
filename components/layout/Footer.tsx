import Link from 'next/link'
import { cities } from '@/lib/venues'

const cityDirectory: { region: string; cities: { name: string; slug: string }[] }[] = [
  { region: 'Yorkshire', cities: [
    { name: 'Hull', slug: 'hull' }, { name: 'Leeds', slug: 'leeds' }, { name: 'Sheffield', slug: 'sheffield' },
    { name: 'York', slug: 'york' }, { name: 'Bradford', slug: 'bradford' }, { name: 'Doncaster', slug: 'doncaster' },
    { name: 'Barnsley', slug: 'barnsley' }, { name: 'Huddersfield', slug: 'huddersfield' },
    { name: 'Halifax', slug: 'halifax' }, { name: 'Beverley', slug: 'beverley' }, { name: 'Bridlington', slug: 'bridlington' },
  ]},
  { region: 'North West', cities: [
    { name: 'Manchester', slug: 'manchester' }, { name: 'Liverpool', slug: 'liverpool' },
    { name: 'Blackpool', slug: 'blackpool' }, { name: 'Bolton', slug: 'bolton' },
  ]},
  { region: 'North East', cities: [
    { name: 'Newcastle', slug: 'newcastle' }, { name: 'Sunderland', slug: 'sunderland' },
  ]},
  { region: 'Scotland', cities: [
    { name: 'Edinburgh', slug: 'edinburgh' }, { name: 'Glasgow', slug: 'glasgow' },
    { name: 'Aberdeen', slug: 'aberdeen' }, { name: 'Inverness', slug: 'inverness' },
  ]},
  { region: 'Midlands', cities: [
    { name: 'Birmingham', slug: 'birmingham' }, { name: 'Nottingham', slug: 'nottingham' },
    { name: 'Leicester', slug: 'leicester' }, { name: 'Stoke-on-Trent', slug: 'stoke' },
    { name: 'Lincoln', slug: 'lincoln' },
  ]},
  { region: 'East of England', cities: [
    { name: 'Norwich', slug: 'norwich' }, { name: 'Ipswich', slug: 'ipswich' },
    { name: 'Colchester', slug: 'colchester' }, { name: 'Southend-on-Sea', slug: 'southend' },
  ]},
  { region: 'London & South East', cities: [
    { name: 'London', slug: 'london' }, { name: 'Brighton', slug: 'brighton' },
    { name: 'Portsmouth', slug: 'portsmouth' }, { name: 'Hastings', slug: 'hastings' },
    { name: 'Romsey', slug: 'romsey' },
  ]},
  { region: 'South West & Wales', cities: [
    { name: 'Bristol', slug: 'bristol' }, { name: 'Bournemouth', slug: 'bournemouth' },
    { name: 'Cardiff', slug: 'cardiff' }, { name: 'Swansea', slug: 'swansea' },
  ]},
]

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.87a8.27 8.27 0 004.84 1.55V7a4.85 4.85 0 01-1.07-.31z"/>
    </svg>
  )
}

interface FooterProps {
  /** Minimal footer with just copyright (for detail pages) */
  minimal?: boolean
}

export function Footer({ minimal = false }: FooterProps) {
  const majorCitySlugs = ['london', 'manchester', 'leeds', 'sheffield', 'york', 'hull']
  const majorCities = majorCitySlugs
    .map((slug) => cities.find((city) => city.slug === slug))
    .filter((city): city is (typeof cities)[number] => !!city)

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
            <p className="text-sm mb-5">Helping UK families find the best soft play centres since 2025.</p>
            <div className="flex gap-3">
              <a
                href="https://www.facebook.com/softplaynearme"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Facebook"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <FacebookIcon />
              </a>
              <a
                href="https://www.instagram.com/softplaynearme"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on Instagram"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.tiktok.com/@softplaynearme"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow us on TikTok"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <TikTokIcon />
              </a>
            </div>
          </div>
          <div>
            <h2 className="font-semibold text-white mb-4">Popular Cities</h2>
            <ul className="space-y-2 text-sm">
              {majorCities.map((city) => (
                <li key={city.slug}>
                  <Link href={`/soft-play/${city.slug}`} className="hover:text-white transition-colors">
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-white mb-4">Quick Links</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/search" className="hover:text-white transition-colors">Search Venues</Link></li>
              <li><Link href="/search?filters=toddler" className="hover:text-white transition-colors">Toddler Soft Play</Link></li>
              <li><Link href="/search?filters=parties" className="hover:text-white transition-colors">Birthday Parties</Link></li>
              <li><Link href="/search?filters=sen" className="hover:text-white transition-colors">SEN Friendly</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Soft Play Blog</Link></li>
              <li><Link href="/add-venue" className="hover:text-white transition-colors">Add Your Venue</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold text-white mb-4">About</h2>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
            <div className="mt-6 pt-6 border-t border-slate-800">
              <p className="text-sm text-slate-300 font-medium mb-2">Own a soft play?</p>
              <Link
                href="/add-venue"
                className="inline-block text-sm bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-md transition-colors"
              >
                Get a free listing →
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-8 pt-8">
          <h2 className="font-semibold text-white mb-5 text-sm">Soft Play Centres by Region</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-6">
            {cityDirectory.map((group) => (
              <div key={group.region}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{group.region}</p>
                <ul className="space-y-1">
                  {group.cities.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/soft-play/${c.slug}`} className="text-xs hover:text-white transition-colors">
                        Soft Play in {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 mt-8 pt-6 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Soft Play Near Me. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
