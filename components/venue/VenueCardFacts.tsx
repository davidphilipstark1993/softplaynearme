import { Clock, PoundSterling, Users } from 'lucide-react'
import { formatAgeRange, formatPrice, priceNumber, todayHoursLabel, type HoursPrice } from '@/lib/venueFacts'
import { formatLastVerified } from '@/lib/venueCardText'

interface VenueCardFactsProps {
  venue: HoursPrice & { last_verified_at?: string | Date | null }
}

/**
 * The practical facts a card can honestly show: today's hours, age range and a
 * starting price. Each line appears only when we hold the data — hours say "Hours not
 * available" when missing, and price is simply omitted (no placeholder, no
 * estimate). The verified date comes from the venue's own last_verified_at.
 */
export function VenueCardFacts({ venue }: VenueCardFactsProps) {
  const hoursLabel = todayHoursLabel(venue)
  const priceFrom = priceNumber(venue.price_from)
  const priceTo = priceNumber(venue.price_to)
  const ageLabel = formatAgeRange(venue)
  const verifiedOn = formatLastVerified(venue.last_verified_at)

  return (
    <ul className="mb-3 space-y-1 text-xs text-slate-600">
      <li className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
        {hoursLabel ? <span>{hoursLabel}</span> : <span className="text-slate-400">Hours not available</span>}
      </li>
      {ageLabel && (
        <li className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span>{ageLabel}</span>
        </li>
      )}
      {priceFrom !== null && (
        <li className="flex items-center gap-1.5">
          <PoundSterling className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            {priceTo !== null && priceTo !== priceFrom
              ? `${formatPrice(priceFrom)}–${formatPrice(priceTo)} per child`
              : `From ${formatPrice(priceFrom)} per child`}
            {verifiedOn ? ` · verified ${verifiedOn}` : ''}
          </span>
        </li>
      )}
    </ul>
  )
}
