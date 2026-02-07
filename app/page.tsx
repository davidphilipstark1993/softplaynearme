'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, MapPin, Clock, Baby, PartyPopper, Heart, Coffee, Car } from 'lucide-react'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { cities } from '@/lib/venues'
import { SearchForm } from '@/components/search/SearchForm'
import { isValidUKPostcode } from '@/lib/geo'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const HOME_FAQS = [
  {
    question: 'What age is soft play suitable for?',
    answer: 'Most soft play centres welcome children from babies up to around 11-12 years old. Many have separate areas for toddlers (under 3s or 4s) to ensure they can play safely away from older children.',
  },
  {
    question: 'How much does soft play cost?',
    answer: 'Prices typically range from \u00A34-10 per child for a standard session. Many venues offer discounts for siblings, and under 1s often go free. Off-peak sessions are usually cheaper than weekends and school holidays.',
  },
  {
    question: 'What should I bring to soft play?',
    answer: 'Socks are essential (grip socks are ideal). Bring a change of clothes for younger children, water bottles, and snacks if the venue allows. Most places have lockers or storage for bags and pushchairs.',
  },
  {
    question: 'Can I book a birthday party at soft play?',
    answer: 'Yes! Most soft play centres offer birthday party packages including dedicated party rooms, food, and play time. Packages usually include invitations and party bags. Book early as weekends fill up quickly.',
  },
]

// FAQPage schema for SEO
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
}

export default function Home() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      if (isValidUKPostcode(searchTerm.trim())) {
        router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}&radius=10`)
        return
      }

      const cityMatch = cities.find(
        c => c.name.toLowerCase() === searchTerm.toLowerCase() ||
             c.slug === searchTerm.toLowerCase()
      )
      if (cityMatch) {
        router.push(`/soft-play/${cityMatch.slug}`)
      } else {
        router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}&radius=10`)
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* FAQ Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Header />

      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 text-white py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Find the Best Soft Play Centres Near You
          </h1>
          <p className="text-purple-100 text-lg mb-8">
            Discover indoor play centres across the UK. Compare venues, check opening times, and find the perfect place for your family.
          </p>

          <div className="bg-white rounded-xl p-4 shadow-lg max-w-2xl mx-auto">
            <SearchForm showRadius={true} defaultRadius={10} />
          </div>

          <p className="text-purple-200 text-sm mt-6">
            Popular:{' '}
            {cities.slice(0, 4).map((city, i) => (
              <span key={city.slug}>
                {i > 0 && ' \u00B7 '}
                <Link href={`/soft-play/${city.slug}`} className="underline hover:text-white">
                  {city.name}
                </Link>
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="bg-white py-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">What are you looking for?</h2>
          <p className="text-slate-600 text-center mb-8">Filter by what matters most to your family</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { href: '/search?filters=open_now', icon: Clock, label: 'Open Now' },
              { href: '/search?filters=toddler', icon: Baby, label: 'Toddler Friendly' },
              { href: '/search?filters=parties', icon: PartyPopper, label: 'Birthday Parties' },
              { href: '/search?filters=sen', icon: Heart, label: 'SEN Friendly' },
              { href: '/search?filters=cafe', icon: Coffee, label: 'Has Cafe' },
              { href: '/search?filters=parking', icon: Car, label: 'Free Parking' },
            ].map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} className="group">
                <Card className="p-4 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                  <Icon className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold text-slate-900 group-hover:text-purple-600 text-sm sm:text-base">{label}</h3>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Browse by City */}
      <div className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Browse by Location</h2>
          <p className="text-slate-600 text-center mb-8">Find soft play centres in your area</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
            {[
              { icon: Search, title: 'Easy to Search', desc: 'Find soft play centres by postcode or location. Filter by facilities, distance, and special features.' },
              { icon: Clock, title: 'Up-to-Date Info', desc: 'Check opening times, prices, and facilities before you visit. See what\u2019s open now.' },
              { icon: Heart, title: 'Family Focused', desc: 'Built by parents, for parents. We understand what matters when choosing a soft play venue.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{title}</h3>
                <p className="text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {HOME_FAQS.map((faq) => (
              <div key={faq.question} className="bg-white p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-lg mb-2">{faq.question}</h3>
                <p className="text-slate-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
