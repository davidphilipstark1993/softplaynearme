'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Clock, Baby, PartyPopper, Heart, Coffee, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { cities } from '@/lib/venues'
import { SearchForm } from '@/components/search/SearchForm'
import { isValidUKPostcode } from '@/lib/geo'

export default function Home() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      // Check if it's a postcode
      if (isValidUKPostcode(searchTerm.trim())) {
        router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}&radius=10`)
        return
      }

      // Try to find a matching city
      const cityMatch = cities.find(
        c => c.name.toLowerCase() === searchTerm.toLowerCase() ||
             c.slug === searchTerm.toLowerCase()
      )
      if (cityMatch) {
        router.push(`/soft-play/${cityMatch.slug}`)
      } else {
        // Try postcode search
        router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}&radius=10`)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-xl text-purple-600">Soft Play Near Me</span>
          </Link>
          <div className="hidden sm:flex gap-4">
            <Link href="/search">
              <Button variant="ghost">Find Soft Play</Button>
            </Link>
            <Link href="/about">
              <Button variant="ghost">About</Button>
            </Link>
            <Link href="/add-venue">
              <Button className="bg-purple-600 text-white hover:bg-purple-700">
                Add Venue
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 text-white py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Find the Best Soft Play Centres Near You
          </h1>
          <p className="text-purple-100 text-lg mb-8">
            Discover indoor play centres across the UK. Compare venues, check opening times, and find the perfect place for your family.
          </p>

          {/* Enhanced Search Form */}
          <div className="bg-white rounded-xl p-4 shadow-lg max-w-2xl mx-auto">
            <SearchForm
              showRadius={true}
              defaultRadius={10}
            />
          </div>

          {/* Quick city links */}
          <p className="text-purple-200 text-sm mt-6">
            Popular:{' '}
            <Link href="/soft-play/hull" className="underline hover:text-white">Hull</Link> ·{' '}
            <Link href="/soft-play/york" className="underline hover:text-white">York</Link> ·{' '}
            <Link href="/soft-play/leeds" className="underline hover:text-white">Leeds</Link> ·{' '}
            <Link href="/soft-play/sheffield" className="underline hover:text-white">Sheffield</Link>
          </p>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="bg-white py-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">What are you looking for?</h2>
          <p className="text-slate-600 text-center mb-8">Filter by what matters most to your family</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Link href="/search?filters=open_now" className="group">
              <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                <Clock className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">Open Now</h3>
              </Card>
            </Link>
            <Link href="/search?filters=toddler" className="group">
              <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                <Baby className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">Toddler Friendly</h3>
              </Card>
            </Link>
            <Link href="/search?filters=parties" className="group">
              <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                <PartyPopper className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">Birthday Parties</h3>
              </Card>
            </Link>
            <Link href="/search?filters=sen" className="group">
              <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                <Heart className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">SEN Friendly</h3>
              </Card>
            </Link>
            <Link href="/search?filters=cafe" className="group">
              <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                <Coffee className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">Has Cafe</h3>
              </Card>
            </Link>
            <Link href="/search?filters=parking" className="group">
              <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                <Car className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">Free Parking</h3>
              </Card>
            </Link>
          </div>
        </div>
      </div>

      {/* Browse by City */}
      <div className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Browse by Location</h2>
          <p className="text-slate-600 text-center mb-8">Find soft play centres in your area</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {cities.map((city) => (
              <Link key={city.slug} href={`/soft-play/${city.slug}`} className="group">
                <Card className="p-6 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                  <MapPin className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                  <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">{city.name}</h3>
                  <p className="text-sm text-slate-500">{city.county}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Why Use Us */}
      <div className="bg-purple-50 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Why Use Soft Play Near Me?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Easy to Search</h3>
              <p className="text-slate-600">Find soft play centres by postcode or location. Filter by facilities, distance, and special features.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Up-to-Date Info</h3>
              <p className="text-slate-600">Check opening times, prices, and facilities before you visit. See what's open now.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Family Focused</h3>
              <p className="text-slate-600">Built by parents, for parents. We understand what matters when choosing a soft play venue.</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-lg mb-2">What age is soft play suitable for?</h3>
              <p className="text-slate-600">Most soft play centres welcome children from babies up to around 11-12 years old. Many have separate areas for toddlers (under 3s or 4s) to ensure they can play safely away from older children.</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-lg mb-2">How much does soft play cost?</h3>
              <p className="text-slate-600">Prices typically range from £4-10 per child for a standard session. Many venues offer discounts for siblings, and under 1s often go free. Off-peak sessions are usually cheaper than weekends and school holidays.</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-lg mb-2">What should I bring to soft play?</h3>
              <p className="text-slate-600">Socks are essential (grip socks are ideal). Bring a change of clothes for younger children, water bottles, and snacks if the venue allows. Most places have lockers or storage for bags and pushchairs.</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-lg mb-2">Can I book a birthday party at soft play?</h3>
              <p className="text-slate-600">Yes! Most soft play centres offer birthday party packages including dedicated party rooms, food, and play time. Packages usually include invitations and party bags. Book early as weekends fill up quickly.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
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
                <li><Link href="/soft-play/hull" className="hover:text-white">Hull</Link></li>
                <li><Link href="/soft-play/york" className="hover:text-white">York</Link></li>
                <li><Link href="/soft-play/leeds" className="hover:text-white">Leeds</Link></li>
                <li><Link href="/soft-play/sheffield" className="hover:text-white">Sheffield</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/search?filters=toddler" className="hover:text-white">Toddler Soft Play</Link></li>
                <li><Link href="/search?filters=parties" className="hover:text-white">Birthday Parties</Link></li>
                <li><Link href="/search?filters=sen" className="hover:text-white">SEN Friendly</Link></li>
                <li><Link href="/add-venue" className="hover:text-white">Add Your Venue</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">About</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Soft Play Near Me. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
