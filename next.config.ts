import type { NextConfig } from "next";
import redirectEntries from "./data/redirects.json";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ssl.gstatic.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  // 301s for venues moved to the correct city or merged into another listing
  // during the data-quality overhaul (see /reports/data-quality-audit.md).
  // Populated by scripts/migrations/*.mjs when they run against the DB —
  // starts empty, safe to ship ahead of those migrations actually running.
  async redirects() {
    return redirectEntries as Array<{
      source: string;
      destination: string;
      permanent: boolean;
    }>;
  },
};

export default nextConfig;
