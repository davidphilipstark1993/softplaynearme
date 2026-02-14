import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export const metadata: Metadata = {
  title: 'About Us | Soft Play Near Me',
  description: 'Soft Play Near Me is a free UK directory helping families find the best indoor soft play centres. Built by parents, for parents.',
  alternates: { canonical: 'https://www.softplaynearme.co.uk/about' },
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

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="prose prose-slate max-w-none space-y-6">
          <p className="text-lg text-slate-700">
            Soft Play Near Me is a free, independent directory of indoor soft play centres across the United Kingdom. We help parents and carers find, compare, and choose the best venues for their families.
          </p>

          <h2 className="text-xl font-semibold mt-8">Why we built this</h2>
          <p className="text-slate-600">
            As parents ourselves, we know how frustrating it can be to find reliable information about soft play centres. Opening times change, facilities vary, and it can be hard to know which venue is right for your child&apos;s age and needs. We built Soft Play Near Me to solve this problem — a single, up-to-date resource where families can find everything they need in one place.
          </p>

          <h2 className="text-xl font-semibold mt-8">What we offer</h2>
          <p className="text-slate-600">
            Every listing on our directory includes the venue&apos;s address, contact details, facilities, and directions. We highlight important features like toddler areas, SEN-friendly sessions, birthday party options, on-site cafes, and free parking. Our search lets you find venues by postcode so you can see what&apos;s closest to you.
          </p>

          <h2 className="text-xl font-semibold mt-8">For venue owners</h2>
          <p className="text-slate-600">
            If you run a soft play centre, you can <Link href="/add-venue" className="text-purple-600 hover:underline">add your venue</Link> to our directory completely free. Claiming your listing lets you update your information, add photos, and ensure families see accurate details about your venue. There are no hidden fees or premium tiers.
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
