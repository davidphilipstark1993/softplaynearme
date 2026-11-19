import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ssl.gstatic.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      // Vercel Blob: owner-uploaded venue photos and ad creatives
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  // Venue 301s (data/redirects.json) are served by proxy.ts, not redirects() here:
  // ~1,400 entries as config routes would approach Vercel's 2,048-route cap.
};

export default nextConfig;
