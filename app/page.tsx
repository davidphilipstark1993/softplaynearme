import { Search, MapPin, Clock, Baby, PartyPopper, Heart, Coffee, Car, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cities } from '@/lib/venues'
import { getStaticVenuesByTown } from '@/lib/staticVenues'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SearchHero } from '@/components/home/SearchHero'
import { buildFAQSchema } from '@/lib/schema'
import { JsonLd } from '@/components/seo/JsonLd'
import { blogPosts } from '@/lib/blogPosts'

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
  {
    question: 'Do I need to book soft play in advance?',
    answer: 'For general play sessions, most venues operate on a walk-in basis. However, some larger centres now offer timed sessions during busy periods. Birthday parties always need to be booked in advance.',
  },
  {
    question: 'Are soft play centres suitable for babies?',
    answer: 'Yes, many soft play centres have dedicated baby areas with soft mats, sensory toys, and mirrors. Babies under 12 months are often free. Look for venues with a separate under-2s or under-3s section.',
  },
]

const faqSchema = buildFAQSchema(HOME_FAQS)

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <JsonLd data={faqSchema} />

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

          <SearchHero />

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

      {/* How It Works */}
      <div className="py-16 px-4 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-12">
            {/* For Parents */}
            <div>
              <h3 className="text-xl font-semibold text-purple-600 mb-6">For Parents</h3>
              <ol className="space-y-5">
                {[
                  { step: '1', title: 'Search by location', desc: 'Enter your postcode or city to find venues nearby' },
                  { step: '2', title: 'Compare venues', desc: 'Check facilities, prices, opening times, and reviews' },
                  { step: '3', title: 'Visit and enjoy', desc: 'Get directions, call ahead, or just turn up and play' },
                ].map(({ step, title, desc }) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold flex items-center justify-center text-sm">
                      {step}
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-slate-600">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            {/* For Venue Owners */}
            <div>
              <h3 className="text-xl font-semibold text-green-600 mb-6">For Venue Owners</h3>
              <ol className="space-y-5">
                {[
                  { step: '1', title: 'Find your venue', desc: 'Search for your soft play centre in our directory' },
                  { step: '2', title: 'Claim your listing', desc: 'Email us to verify you\'re the owner \u2014 it\'s completely free' },
                  { step: '3', title: 'Manage your profile', desc: 'Update hours, add photos, and highlight your facilities' },
                ].map(({ step, title, desc }) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold flex items-center justify-center text-sm">
                      {step}
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-slate-600">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Browse by City */}
      <div className="py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Browse by Location</h2>
          <p className="text-slate-600 text-center mb-8">Find soft play centres in your area</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {cities.map((city) => {
              const venueCount = getStaticVenuesByTown(city.slug).length
              return (
                <Link key={city.slug} href={`/soft-play/${city.slug}`} className="group">
                  <Card className="p-6 text-center hover:shadow-lg hover:border-purple-300 transition-all">
                    <MapPin className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                    <h3 className="font-semibold text-slate-900 group-hover:text-purple-600">{city.name}</h3>
                    <p className="text-sm text-slate-500">{city.county}</p>
                    {venueCount > 0 && (
                      <p className="text-xs text-purple-600 font-medium mt-1">{venueCount} {venueCount === 1 ? 'venue' : 'venues'}</p>
                    )}
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Venue Owners CTA */}
      <div className="bg-green-50 py-16 px-4 border-y border-green-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-green-800 mb-4">
            Venue Owners: Claim Your Free Profile
          </h2>
          <p className="text-green-700 mb-6 max-w-xl mx-auto">
            Join soft play centres already listed on our directory. Update your information,
            add photos, and help families find your venue. Always free.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-6 text-sm text-green-700">
            {['Free to claim', 'UK-wide directory', 'Updated by owners'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                {item}
              </span>
            ))}
          </div>
          <Button asChild className="bg-green-600 hover:bg-green-700">
            <a href="mailto:info@softplaynearme.co.uk?subject=Claim%20My%20Venue">
              Claim Your Venue (Free)
            </a>
          </Button>
        </div>
      </div>

      {/* Blog Links */}
      <div className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">From the Soft Play Blog</h2>
              <p className="text-slate-600 mt-2">Planning tips, toddler guides, and venue ideas.</p>
            </div>
            <Link href="/blog" className="text-sm font-semibold text-purple-700 hover:underline">
              View all posts
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {blogPosts.slice(0, 3).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="group">
                <Card className="h-full p-5 border-slate-200 hover:border-purple-300 hover:shadow-md transition-all">
                  <h3 className="font-semibold text-slate-900 group-hover:text-purple-700">{post.title}</h3>
                  <p className="text-sm text-slate-600 mt-2">{post.excerpt}</p>
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

      {/* SEO Content Block */}
      <div className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            Your Complete Guide to Soft Play in the UK
          </h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            <p>
              Soft play centres have become one of the most popular indoor activities for families across the UK, and for good reason. They offer children a safe, supervised environment to climb, slide, bounce, and explore — whatever the weather. For parents, they provide a chance to relax with a coffee while the kids burn off energy.
            </p>
            <p>
              Whether you are looking for <Link href="/soft-play/hull" className="text-purple-600 hover:underline">soft play in Hull</Link>, <Link href="/soft-play/leeds" className="text-purple-600 hover:underline">indoor play centres in Leeds</Link>, <Link href="/soft-play/york" className="text-purple-600 hover:underline">family venues in York</Link>, or <Link href="/soft-play/sheffield" className="text-purple-600 hover:underline">play areas in Sheffield</Link>, our directory helps you compare your options in one place. Every listing includes the venue&apos;s address, contact details, facilities, and directions.
            </p>
            <p>
              Most modern soft play centres cater to a wide range of ages. Dedicated baby areas with sensory toys and soft mats are perfect for under-1s, while toddler zones with gentle slides and ball pits suit children up to around three or four years old. Older children can enjoy multi-level climbing frames, zip lines, and adventure courses. Many venues also offer <Link href="/search?filters=parties" className="text-purple-600 hover:underline">birthday party packages</Link> with private rooms and catering.
            </p>
            <p>
              Accessibility is increasingly important to families, and a growing number of venues now run <Link href="/search?filters=sen" className="text-purple-600 hover:underline">SEN-friendly sessions</Link> with reduced noise, lower lighting, and smaller group sizes. These quieter sessions give children with additional needs the chance to play in a more comfortable environment.
            </p>
            <p>
              Soft Play Near Me was created to help families find the right venue quickly and easily. We focus on accurate, up-to-date information so you can check opening times, compare facilities, and plan your visit with confidence. Venue owners can claim their listing for free to manage their profile, add photos, and keep their information current.
            </p>
            <p>
              Browse our <Link href="/search" className="text-purple-600 hover:underline">full search</Link> to find soft play centres near your postcode, or explore by location using the links above. From <Link href="/search?filters=toddler" className="text-purple-600 hover:underline">toddler-friendly venues</Link> to centres with cafes and free parking, we make it simple to find the perfect indoor play destination for your family.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 px-4 bg-slate-100">
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
