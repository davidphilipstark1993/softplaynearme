import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'

// The root layout applies `template: "%s | Soft Play Near Me"`, so `title` must
// NOT repeat the suffix. Social cards bypass the template, so they keep it.
const TITLE = 'Privacy Policy'
const SOCIAL_TITLE = 'Privacy Policy | Soft Play Near Me'
const DESCRIPTION =
  'Privacy policy for Soft Play Near Me. Learn how we handle your data when you use our soft play directory.'
const URL = 'https://www.softplaynearme.co.uk/privacy'

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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <Breadcrumbs items={[{ label: 'Privacy Policy' }]} />

      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-slate max-w-none space-y-6 text-slate-600">
          <p className="text-sm text-slate-500">Last updated: February 2025</p>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Who we are</h2>
          <p>
            Soft Play Near Me is a free directory of soft play centres in the United Kingdom, operated at softplaynearme.co.uk. This privacy policy explains how we collect, use, and protect your information when you visit our website.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">What data we collect</h2>
          <p>We collect minimal data to provide and improve our service:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Search queries:</strong> When you search for a postcode or location, this is processed to show relevant results. We do not store individual search queries.</li>
            <li><strong>Location data:</strong> If you use the &quot;Use my location&quot; feature, your browser may share your approximate location. This is used only to show nearby venues and is not stored on our servers.</li>
            <li><strong>Analytics data:</strong> We use Google Analytics to understand how visitors use our site. This collects anonymised data such as pages visited, time on site, and device type. No personally identifiable information is collected through analytics.</li>
            <li><strong>Contact emails:</strong> If you email us (e.g. to add a venue or report an error), we store your email address and message to respond to your enquiry.</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Cookies</h2>
          <p>
            Our site uses cookies from Google Analytics to measure website traffic and understand how visitors interact with the site. These are third-party cookies that do not contain personal information. You can control cookie settings through your browser preferences.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Third-party services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Google Analytics:</strong> For anonymised website traffic analysis.</li>
            <li><strong>Google Maps:</strong> For venue maps and directions.</li>
            <li><strong>Postcodes.io:</strong> For postcode geocoding (converting postcodes to coordinates for search).</li>
            <li><strong>Vercel:</strong> For website hosting.</li>
          </ul>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Your rights</h2>
          <p>
            Under UK data protection law (UK GDPR), you have the right to access, correct, or delete any personal data we hold about you. Since we collect minimal personal data, this primarily applies to any emails you have sent us. To exercise these rights, please contact us at{' '}
            <a href="mailto:info@softplaynearme.co.uk" className="text-purple-600 hover:underline">info@softplaynearme.co.uk</a>.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Children&apos;s privacy</h2>
          <p>
            Our website is designed for parents and carers looking for soft play venues for their children. We do not knowingly collect personal information from children under 13. The site does not require account registration or login.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Changes to this policy</h2>
          <p>
            We may update this privacy policy from time to time. Any changes will be posted on this page with an updated date.
          </p>

          <h2 className="text-xl font-semibold text-slate-900 mt-8">Contact</h2>
          <p>
            If you have questions about this privacy policy, please contact us at{' '}
            <a href="mailto:info@softplaynearme.co.uk" className="text-purple-600 hover:underline">info@softplaynearme.co.uk</a>.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
