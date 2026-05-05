/**
 * Generates a shimmer SVG as a base64-encoded blur placeholder for next/image.
 * Use as: blurDataURL={shimmerDataURL(700, 475)} placeholder="blur"
 */
export function shimmerDataURL(w: number, h: number): string {
  const svg = `
<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="g">
      <stop stop-color="#e2e8f0" offset="20%" />
      <stop stop-color="#f1f5f9" offset="50%" />
      <stop stop-color="#e2e8f0" offset="70%" />
    </linearGradient>
    <filter id="f">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)" />
</svg>`
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}
