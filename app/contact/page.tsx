import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mail } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ContactForm } from '@/components/forms/ContactForm'

// The root layout applies `template: "%s | Soft Play Near Me"`, so `title` must
// NOT repeat the suffix. Social cards bypass the template, so they keep it.
const TITLE = 'Report, Suggest or Claim a Venue'
const SOCIAL_TITLE = 'Report, Suggest or Claim a Venue | Soft Play Near Me'
const DESCRIPTION =
  "Spotted a mistake or know a soft play centre we've missed? Contact the Soft Play Near Me team to report an error, suggest a venue or claim your listing."
const URL = 'https://www.softplaynearme.co.uk/contact'

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

      <main id="main-content" className="max-w-2xl mx-auto px-4 py-12">
        <Card className="p-6 sm:p-8 mb-8">
          <h2 className="font-semibold text-lg mb-4">Send us a message</h2>
          <ContactForm />
        </Card>

        <div className="text-center mb-6">
          <p className="text-sm text-slate-500">Prefer email? Reach us directly:</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4 text-center">
            <h3 className="font-medium text-sm mb-2">General enquiries</h3>
            <Button asChild size="sm" variant="outline" className="w-full">
              <a href="mailto:info@softplaynearme.co.uk">
                <Mail className="w-3.5 h-3.5 mr-1.5" /> Email us
              </a>
            </Button>
          </Card>

          <Card className="p-4 text-center">
            <h3 className="font-medium text-sm mb-2">Add or claim a venue</h3>
            <Button asChild size="sm" variant="outline" className="w-full">
              <a href="mailto:info@softplaynearme.co.uk?subject=Add%20/%20Claim%20Venue">
                <Mail className="w-3.5 h-3.5 mr-1.5" /> Email us
              </a>
            </Button>
          </Card>

          <Card className="p-4 text-center">
            <h3 className="font-medium text-sm mb-2">Report an error</h3>
            <Button asChild size="sm" variant="outline" className="w-full">
              <a href="mailto:info@softplaynearme.co.uk?subject=Error%20Report">
                <Mail className="w-3.5 h-3.5 mr-1.5" /> Email us
              </a>
            </Button>
          </Card>
        </div>

        <p className="text-center text-sm text-slate-500 mt-8">
          We aim to respond to all messages within 48 hours.
        </p>
      </main>

      <Footer />
    </div>
  )
}
