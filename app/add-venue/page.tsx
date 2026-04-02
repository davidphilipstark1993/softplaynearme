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
  searchParams: Promise<{ venue?: string; city?: string; slug?: string }>
}

export default async function AddVenuePage({ searchParams }: AddVenuePageProps) {
  const { venue, city, slug } = await searchParams
  const venueUrl = city && slug
    ? `https://www.softplaynearme.co.uk/soft-play/${city}/${slug}`
    : undefined
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Add Your Venue' }]} />

      <div className="bg-gradient-to-br from-green-600 to-emerald-500 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-green-200 text-sm font-semibold uppercase tracking-wider mb-3">Free for venue owners</p>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Get Found by Thousands of Local Families
          </h1>
          <p className="text-green-100 text-lg max-w-xl mx-auto">
            Your soft play centre deserves to be visible. Claim or add your free listing on the UK&apos;s fastest-growing indoor play directory.
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
          <ClaimVenueForm
            prefilledVenue={venue || ''}
            citySlug={city || ''}
            venueSlug={slug || ''}
            venueUrl={venueUrl || ''}
          />
        </Card>

        <Card className="p-8 bg-green-50 border-green-200">
          <h2 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Once your listing is live, here&apos;s what to do next
          </h2>
          <ol className="space-y-3 text-sm text-green-800">
            {[
              'Add at least 3 photos — listings with photos get significantly more clicks',
              'Confirm your opening hours for every day of the week',
              'Set your pricing for standard sessions, toddler sessions, and birthday parties',
              'List all your facilities (café, parking, SEN sessions, toddler zone, etc.)',
              'Share your listing on your social media to encourage parent reviews',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Card>

        <div className="text-center text-sm text-slate-500">
          <p>Already listed? <a href="mailto:info@softplaynearme.co.uk?subject=Claim%20My%20Venue" className="text-purple-600 hover:underline">Email us to claim your listing</a> and take control of your profile.</p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
