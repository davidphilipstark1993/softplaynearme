import Link from 'next/link'
import { MapPin, Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { VenueCardFacts } from '@/components/venue/VenueCardFacts'
import { formatAddressLine } from '@/lib/sanitize'
import type { NearbyGroup } from '@/lib/localities'
import type { HoursPrice } from '@/lib/venueFacts'

export interface NearbyVenue extends HoursPrice {
  slug: string
  name: string
  address?: string | null
  postcode?: string | null
  avg_rating?: number | string | null
  review_count?: number | string | null
  last_verified_at?: string | Date | null
}

interface NearbyTownsProps {
  cityName: string
  citySlug: string
  groups: NearbyGroup<NearbyVenue>[]
  /** Hub slug for a town name, if that town has its own hub page. */
  hubSlugFor: (locality: string) => string | null
}

/**
 * Venues in towns around a hub (e.g. Hessle, Cottingham for Hull), kept apart
 * from the hub's main list so each venue appears once. A town with its own hub
 * page links to it; a town without one just names itself — never a dead link.
 */
export function NearbyTowns({ cityName, citySlug, groups, hubSlugFor }: NearbyTownsProps) {
  if (groups.length === 0) return null

  return (
    <section aria-labelledby="nearby-towns-heading" className="mt-12">
      <h2 id="nearby-towns-heading" className="text-xl font-semibold mb-2">
        Soft play near {cityName}
      </h2>
      <p className="text-slate-600 mb-6">
        These venues are in towns just outside {cityName}, so they&apos;re listed here rather than in the {cityName} list above.
      </p>
      <div className="space-y-8">
        {groups.map((group) => {
          const hub = hubSlugFor(group.locality)
          return (
            <div key={group.locality} id={group.anchor} className="scroll-mt-28">
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                {group.locality}
                {hub && (
                  <Link href={`/soft-play/${hub}`} className="ml-3 text-sm font-medium text-purple-600 hover:text-purple-700 underline">
                    All soft play in {group.locality}
                  </Link>
                )}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.venues.map((venue) => {
                  const rating = Number(venue.avg_rating)
                  const address = formatAddressLine(venue.address, venue.postcode)
                  return (
                    <Card key={venue.slug} className="p-4 border-slate-200 hover:shadow-md transition-shadow">
                      <Link href={`/soft-play/${citySlug}/${venue.slug}`} className="font-semibold text-slate-900 hover:text-purple-600">
                        {venue.name}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 mb-2">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{address || group.locality}</span>
                      </div>
                      <VenueCardFacts venue={venue} />
                      {rating > 0 && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" aria-hidden="true" />
                          <span className="font-medium">{rating.toFixed(1)}</span>
                          {Number(venue.review_count) > 0 && <span className="text-slate-400">({Number(venue.review_count).toLocaleString()})</span>}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
