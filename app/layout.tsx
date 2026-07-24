import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#9333ea",
};

// Intentionally static, not generateMetadata() with a live DB count: the
// root layout runs once per statically-generated page (2,300+ of them),
// and React's cache() only dedupes within a single page's render, not
// across pages — a DB-backed root layout would mean one extra query per
// page at build time. The homepage itself (app/page.tsx) already computes
// its own description from real data and overrides this default; every
// other route type (city/venue/filter/blog/static pages) also sets its
// own description. This root-level text is a rarely-seen fallback, not
// worth thousands of build-time queries to keep exactly in sync.
export const metadata: Metadata = {
  title: {
    default: "Soft Play Near Me | Find Soft Play Centres Across the UK",
    template: "%s | Soft Play Near Me",
  },
  description: "Find 1,800+ soft play centres near you across the UK. Search by postcode, compare prices, opening times, facilities, photos & reviews. Free directory updated daily by venue owners.",
  keywords: ["soft play near me", "soft play centres", "indoor play", "toddler soft play", "soft play birthday parties", "SEN soft play", "indoor play centres UK"],
  authors: [{ name: "Soft Play Near Me" }],
  creator: "Soft Play Near Me",
  metadataBase: new URL("https://www.softplaynearme.co.uk"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://www.softplaynearme.co.uk",
    siteName: "Soft Play Near Me",
    title: "Soft Play Near Me | Find Soft Play Centres Across the UK",
    description: "Find 1,800+ soft play centres near you across the UK. Search by postcode, compare prices, opening times, facilities and reviews. Free directory.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Soft Play Near Me | Find Soft Play Centres",
    description: "Find the best soft play centres near you. Compare venues, check opening times, and book birthday parties.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// Organization schema for the entire site
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.softplaynearme.co.uk/#organization",
  name: "Soft Play Near Me",
  url: "https://www.softplaynearme.co.uk",
  logo: {
    "@type": "ImageObject",
    url: "https://www.softplaynearme.co.uk/opengraph-image",
    width: 1200,
    height: 630,
  },
  description: "UK directory helping families find the best soft play centres near them",
  areaServed: {
    "@type": "Country",
    name: "United Kingdom"
  },
  serviceType: "Soft Play Directory",
  knowsAbout: [
    "Soft Play Centres",
    "Indoor Play",
    "Children's Activities",
    "Birthday Party Venues",
    "Toddler Play Areas"
  ],
  sameAs: [
    "https://www.facebook.com/softplaynearme",
    "https://www.instagram.com/softplaynearme",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "info@softplaynearme.co.uk",
    contactType: "customer support",
    areaServed: "GB",
    availableLanguage: "English",
  },
};

// WebSite schema for search
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.softplaynearme.co.uk/#website",
  url: "https://www.softplaynearme.co.uk",
  name: "Soft Play Near Me",
  description: "UK directory helping families find the best soft play centres near them",
  publisher: {
    "@id": "https://www.softplaynearme.co.uk/#organization"
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.softplaynearme.co.uk/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Preconnect to external services for faster loading */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.postcodes.io" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="antialiased">
        {/* Google Analytics with enhanced event tracking */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LELV01QR3Z"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LELV01QR3Z');

            // Track outbound clicks (directions, venue websites, phone calls)
            document.addEventListener('click', function(e) {
              var link = e.target.closest('a');
              if (!link) return;
              var href = link.getAttribute('href') || '';

              if (href.startsWith('tel:')) {
                gtag('event', 'phone_click', { phone: href.replace('tel:', '') });
              } else if (href.startsWith('mailto:')) {
                gtag('event', 'email_click', { email: href.replace('mailto:', '').split('?')[0] });
              } else if (link.target === '_blank') {
                if (href.includes('google.com/maps')) {
                  gtag('event', 'directions_click', { url: href });
                } else if (!href.includes('softplaynearme.co.uk')) {
                  gtag('event', 'outbound_click', { url: href });
                }
              }
            });
          `}
        </Script>
        {children}
        <Toaster position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
