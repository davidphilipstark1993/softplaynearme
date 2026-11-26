import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoogleRatingProps {
  rating?: number | string | null
  count?: number | string | null
  /** overlay: white pill for the corner of a venue photo. inline: plain text row for compact cards. */
  variant?: 'overlay' | 'inline'
  className?: string
}

/**
 * The venue's average Google rating, for venue cards. Renders nothing when the venue has no
 * rating rather than showing a made-up or zero value. Display only: Google ratings stay out of
 * structured data (see buildVenueSchema in lib/schema.ts).
 */
export function GoogleRating({ rating, count, variant = 'inline', className }: GoogleRatingProps) {
  const value = Number(rating)
  if (!Number.isFinite(value) || value <= 0) return null
  const reviews = Number(count)
  const hasCount = Number.isFinite(reviews) && reviews > 0

  const label = hasCount
    ? `Google rating ${value.toFixed(1)} out of 5 from ${reviews.toLocaleString('en-GB')} reviews`
    : `Google rating ${value.toFixed(1)} out of 5`

  return (
    <div
      title={label}
      className={cn(
        'flex items-center gap-1 text-xs',
        variant === 'overlay'
          ? 'bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full shadow font-bold'
          : 'text-slate-500',
        className
      )}
    >
      <span className="sr-only">{label}</span>
      <Star aria-hidden="true" className="w-3 h-3 text-yellow-400 fill-current" />
      <span aria-hidden="true" className={cn('font-medium', variant === 'overlay' ? 'font-bold text-slate-800' : 'text-slate-700')}>
        {value.toFixed(1)}
      </span>
      {hasCount && (
        <span aria-hidden="true" className={variant === 'overlay' ? 'text-slate-400 font-normal' : undefined}>
          ({reviews.toLocaleString('en-GB')})
        </span>
      )}
      <span aria-hidden="true" className={variant === 'overlay' ? 'text-slate-500 font-medium' : undefined}>
        Google
      </span>
    </div>
  )
}
