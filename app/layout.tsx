import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soft Play Near Me | Find Soft Play Centres Across the UK",
  description: "Find the best soft play centres near you. Compare indoor play venues, check opening times, and discover toddler-friendly play areas across the UK.",
  keywords: ["soft play near me", "soft play centres", "indoor play", "toddler soft play", "soft play birthday parties", "SEN soft play"],
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
    description: "Find the best soft play centres near you. Compare indoor play venues, check opening times, and discover toddler-friendly play areas.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Soft Play Near Me - Find Indoor Play Centres",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Soft Play Near Me | Find Soft Play Centres",
    description: "Find the best soft play centres near you. Compare venues, check opening times, and book birthday parties.",
    images: ["/og-image.png"],
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
  ]
};

// WebSite schema for search
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.softplaynearme.co.uk/#website",
  url: "https://www.softplaynearme.co.uk",
  name: "Soft Play Near Me",
  description: "Find soft play centres near you across the UK",
  publisher: {
    "@id": "https://www.softplaynearme.co.uk/#organization"
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: "https://www.softplaynearme.co.uk/soft-play/{search_term_string}"
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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
