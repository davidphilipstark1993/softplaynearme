import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mail } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Contact Us | Soft Play Near Me',
  description: 'Get in touch with the Soft Play Near Me team. Report an error, suggest a venue, or claim your listing.',
  alternates: { canonical: 'https://www.softplaynearme.co.uk/contact' },
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Contact Us' }]} />

      <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-purple-100 text-lg">
            Have a question, correction, or want to list your venue? We&apos;d love to hear from you.
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-2">General enquiries</h2>
            <p className="text-slate-600 text-sm mb-4">
              For questions about the directory, feedback, or partnership enquiries.
            </p>
            <Button asChild className="bg-purple-600 hover:bg-purple-700">
              <a href="mailto:info@softplaynearme.co.uk">
                <Mail className="w-4 h-4 mr-2" /> info@softplaynearme.co.uk
              </a>
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-2">Add or claim a venue</h2>
            <p className="text-slate-600 text-sm mb-4">
              Want to add your soft play centre to the directory or claim an existing listing? Send us your venue details.
            </p>
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <a href="mailto:info@softplaynearme.co.uk?subject=Add%20/%20Claim%20Venue">
                <Mail className="w-4 h-4 mr-2" /> Add or Claim a Venue
              </a>
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-2">Report an error</h2>
            <p className="text-slate-600 text-sm mb-4">
              Spotted incorrect information on a venue listing? Let us know and we&apos;ll fix it promptly.
            </p>
            <Button asChild variant="outline">
              <a href="mailto:info@softplaynearme.co.uk?subject=Error%20Report">
                <Mail className="w-4 h-4 mr-2" /> Report an Error
              </a>
            </Button>
          </Card>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          We aim to respond to all emails within 48 hours.
        </p>
      </main>

      <Footer />
    </div>
  )
}
