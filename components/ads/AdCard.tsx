import type { Ref } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AD_IMAGE_HEIGHT, AD_IMAGE_WIDTH, type AdVariant } from '@/lib/ads/placements'

export interface AdCardData {
  title: string
  description: string
  ctaText: string
  imageUrl: string
  imageAlt: string
  label: string
  sponsored: boolean
  href: string
}

/**
 * Presentational only — shared by the live <AdSlot> and the admin preview so
 * what you preview is exactly what visitors get.
 *
 * Layout-shift safety: the image box is a fixed 16:9 (`aspect-video`) with
 * explicit width/height, so the card is its final height before the artwork
 * has downloaded.
 */
export function AdCard({
  ad,
  variant,
  className,
  rootRef,
  preview = false,
}: {
  ad: AdCardData
  variant: AdVariant
  className?: string
  rootRef?: Ref<HTMLElement>
  /** In the admin preview the link is inert. */
  preview?: boolean
}) {
  const isBanner = variant === 'banner'
  const linkProps = preview
    ? { href: '#', onClick: (e: React.MouseEvent) => e.preventDefault() }
    : {
        href: ad.href,
        target: '_blank',
        // Sponsored third parties are marked up as such for search engines.
        rel: ad.sponsored ? 'sponsored nofollow noopener' : 'nofollow noopener',
      }

  return (
    <aside
      ref={rootRef}
      aria-label={`${ad.label}: ${ad.title}`}
      className={cn(
        'group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md',
        isBanner && 'md:flex md:items-stretch',
        className
      )}
    >
      <a
        {...linkProps}
        tabIndex={-1}
        aria-hidden="true"
        className={cn('relative block aspect-video bg-slate-100', isBanner && 'md:w-2/5 md:shrink-0')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- already resized to 1280x720 WebP at upload */}
        <img
          src={ad.imageUrl}
          alt=""
          width={AD_IMAGE_WIDTH}
          height={AD_IMAGE_HEIGHT}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </a>

      <div className={cn('flex flex-col p-5', isBanner && 'md:flex-1 md:justify-center md:p-7')}>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{ad.label}</p>
        <h3 className={cn('font-bold text-slate-900', isBanner ? 'text-xl md:text-2xl' : 'text-lg')}>{ad.title}</h3>
        {ad.description && (
          <p className={cn('mt-2 text-sm text-slate-600', isBanner ? 'md:text-base' : 'line-clamp-3')}>{ad.description}</p>
        )}
        <div className="mt-4">
          <a
            {...linkProps}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2"
          >
            {ad.ctaText}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
    </aside>
  )
}
