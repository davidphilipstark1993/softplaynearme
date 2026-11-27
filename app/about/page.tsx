import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

// The root layout applies `template: "%s | Soft Play Near Me"`, so `title` must
// NOT repeat the suffix. Social cards bypass the template, so they keep it.
const TITLE = 'Free Parent-Built Soft Play Directory'
const SOCIAL_TITLE = 'Free Parent-Built Soft Play Directory | Soft Play Near Me'
const DESCRIPTION =
  "Soft Play Near Me is a free UK directory of indoor soft play centres, built by parents for parents. How listings are sourced, checked and corrected."
const URL = 'https://www.softplaynearme.co.uk/about'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    url: URL,
    type: 'website',
    siteName: 'Soft Play Near Me',
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title: SOCIAL_TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'About Us' }]} />

      <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">About Soft Play Near Me</h1>
          <p className="text-purple-100 text-lg">
            Helping UK families find the perfect indoor play venue since 2025.
          </p>
        </div>
      </div>

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-lg text-slate-700">
            Soft Play Near Me is a free, independent directory of indoor soft play centres across the United Kingdom. We help parents and carers find, compare, and choose the best venues for their families.
          </p>

          <h2 className="text-xl font-semibold mt-8">Why we built this</h2>
          <p className="text-slate-600">
            As parents ourselves, we know how frustrating it can be to find reliable information about soft play centres. Opening times change, facilities vary, and it can be hard to know which venue is right for your child&apos;s age and needs. We built Soft Play Near Me to put the basics for every centre in one place, and to be clear about what we know and what we don&apos;t.
          </p>

          <h2 className="text-xl font-semibold mt-8">What we offer</h2>
          <p className="text-slate-600">
            Every listing shows the venue&apos;s address and directions, and its contact details and facilities where we have them. We highlight features like toddler areas, SEN-friendly sessions, birthday parties, on-site cafés and parking when a venue offers them. Our search lets you find venues by postcode so you can see what&apos;s closest to you.
          </p>

          <h2 id="how-listings-work" className="text-xl font-semibold mt-8">How our listings work</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong>Where the information comes from.</strong> Listings start from public sources: Google Places data (address, phone, rating and number of reviews) and the venue&apos;s own website. Where a page shows prices, opening hours or age ranges, they are the ones the venue has published.
            </li>
            <li>
              <strong>What we don&apos;t do.</strong> We don&apos;t estimate prices, opening hours or age ranges, and we don&apos;t write reviews. If a page says something isn&apos;t listed, we don&apos;t know it yet. It doesn&apos;t mean the venue lacks it. Ratings are shown with the number of reviews behind them.
            </li>
            <li>
              <strong>Checks and dates.</strong> Venue pages show the date their details were last updated. Listings claimed by the venue itself are marked &quot;Verified by owner&quot;.
            </li>
            <li>
              <strong>Payment never changes the facts.</strong> Premium venues can be shown as Featured, and that placement is labelled. Paying never changes a venue&apos;s rating, reviews or facilities.
            </li>
          </ul>

          <h2 id="corrections" className="text-xl font-semibold mt-8">Corrections</h2>
          <p className="text-slate-600">
            If something on a listing is wrong, or a venue has closed, use the &quot;Report an issue&quot; link at the bottom of the venue&apos;s page, or <Link href="/contact" className="text-purple-600 hover:underline">contact us</Link> and choose &quot;Report an error&quot;. We check reports against the venue&apos;s own website or with the venue, then update the page. Venue owners can fix their own listing straight away by claiming it (below).
          </p>

          <h2 className="text-xl font-semibold mt-8">For venue owners</h2>
          <p className="text-slate-600">
            If you run a soft play centre, you can <Link href="/add-venue" className="text-purple-600 hover:underline">add your venue</Link> to our directory completely free — forever. Claiming your listing lets you update your information, add photos, and ensure families see accurate details about your venue, at no cost. If you want extra visibility, we also offer an optional <Link href="/pricing" className="text-purple-600 hover:underline">Premium plan</Link> with a verified badge, featured placement, and lead notifications — but it&apos;s never required.
          </p>

          <h2 className="text-xl font-semibold mt-8">Get in touch</h2>
          <p className="text-slate-600">
            We&apos;re always looking to improve. If you have feedback, spot an error, or want to suggest a feature, please <Link href="/contact" className="text-purple-600 hover:underline">contact us</Link>.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 justify-center">
          <Button asChild className="bg-purple-600 hover:bg-purple-700">
            <Link href="/search">Search Venues</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/add-venue">Add Your Venue</Link>
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  )
}
