import type { Metadata } from 'next'
import { Card } from '@/components/ui/card'
import { CheckCircle2, MapPin, Phone, Globe } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ClaimVenueForm } from '@/components/forms/ClaimVenueForm'

export const metadata: Metadata = {
  title: 'Add Your Venue | Soft Play Near Me',
  description: 'List your soft play centre on Soft Play Near Me for free. Reach thousands of families looking for indoor play venues in your area.',
  alternates: { canonical: 'https://www.softplaynearme.co.uk/add-venue' },
}

interface AddVenuePageProps {
  searchParams: Promise<{ venue?: string }>
}

export default async function AddVenuePage({ searchParams }: AddVenuePageProps) {
  const { venue } = await searchParams
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Add Your Venue' }]} />

      <div className="bg-gradient-to-br from-green-600 to-emerald-500 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Add Your Soft Play Centre
          </h1>
          <p className="text-green-100 text-lg">
            List your venue on the UK&apos;s growing soft play directory. Completely free, no hidden costs.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <Card className="p-8 mb-8">
          <h2 className="text-xl font-semibold mb-6">What you get</h2>
          <ul className="space-y-4">
            {[
              'Your own venue page with address, contact details, and facilities',
              'Appear in local search results when parents search by postcode',
              'Showcase features like toddler areas, SEN sessions, and birthday parties',
              'Direct links to your website, phone number, and directions',
              'Collect and display reviews from visiting families',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-8 mb-8">
          <h2 className="text-xl font-semibold mb-4">Claim or Add Your Venue</h2>
          <p className="text-slate-600 mb-6">
            Submit this quick form and our team will review your listing claim or new venue request.
          </p>
          <ul className="space-y-3 text-slate-700 mb-8">
            <li className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              Venue name and full address (including postcode)
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              Phone number
            </li>
            <li className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-400" />
              Website and social media links
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              Facilities (cafe, parking, toddler area, SEN sessions, parties, etc.)
            </li>
          </ul>
          <ClaimVenueForm prefilledVenue={venue || ''} />
        </Card>

        <div className="text-center text-sm text-slate-500">
          <p>Already listed? <a href="mailto:info@softplaynearme.co.uk?subject=Claim%20My%20Venue" className="text-purple-600 hover:underline">Claim your listing</a> to manage your venue profile.</p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
