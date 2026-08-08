'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Wraps next/image with an onError fallback. If the remote image fails to
 * load (e.g. a hotlinked Unsplash photo gets taken down or link-rots), shows
 * a plain gradient placeholder instead of a broken-image icon — no second
 * network request to a fallback URL that could itself fail.
 *
 * Server Components can't attach onError handlers directly (it's a DOM
 * event), so any <Image> that hotlinks an external, not-fully-controlled
 * source (Unsplash city photos, venue photos scraped from Google) should go
 * through this wrapper instead of next/image directly.
 */
export function ImageWithFallback({ alt, className, ...props }: ImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100',
          className
        )}
        role="img"
        aria-label={alt}
      >
        <MapPin className="w-8 h-8 text-purple-300" />
      </div>
    )
  }

  return <Image alt={alt} className={className} onError={() => setFailed(true)} {...props} />
}
