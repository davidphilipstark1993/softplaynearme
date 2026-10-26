import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { calculateDistance, formatDistance } from '@/lib/geo'

export interface NearTownVenue {
  slug: string
  name: string
  lat?: number | string | null
  lng?: number | string | null
  /** The venue's real town (lib/localities.ts), if known. */
  area: string | null
}

const SHOW = 4
/** Beyond this a venue isn't "near" anywhere. */
const MAX_MILES = 15
/** A venue this close counts as being in the town itself. */
const IN_TOWN_MILES = 2

/**
 * "Soft play near <town>" for a town people search for but that has no hub page of its own.
 * Lists the closest real venues by straight-line distance from the town centre. If nothing
 * is within IN_TOWN_MILES it says so plainly rather than implying there is. Renders nothing
 * when no venue is within MAX_MILES, or when no venue has coordinates.
 */
export function NearTown({ town, centre, venues, hubSlug }: { town: string; centre: { lat: number; lng: number }; venues: NearTownVenue[]; hubSlug: string }) {
  const ranked = venues
    .map((v) => ({ v, miles: calculateDistance(centre, { lat: Number(v.lat), lng: Number(v.lng) }) }))
    .filter((r) => Number.isFinite(r.miles) && Number(r.v.lat) !== 0 && r.miles <= MAX_MILES)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, SHOW)
  if (ranked.length === 0) return null
  const inTown = ranked.filter((r) => r.miles <= IN_TOWN_MILES).length

  return (
    <section aria-labelledby={`near-${town.toLowerCase()}-heading`} id={`near-${town.toLowerCase()}`} className="mt-12 scroll-mt-28">
      <h2 id={`near-${town.toLowerCase()}-heading`} className="text-xl font-semibold mb-2">Soft play near {town}</h2>
      <p className="text-slate-600 mb-4">
        {inTown === 0
          ? `We don't list a soft play centre in ${town} itself. These are the closest, by straight-line distance from the town centre.`
          : `The closest soft play to ${town}, by straight-line distance from the town centre.`}
      </p>
      <ul className="grid sm:grid-cols-2 gap-3">
        {ranked.map(({ v, miles }) => (
          <li key={v.slug}>
            <Link href={`/soft-play/${hubSlug}/${v.slug}`} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-colors">
              <MapPin className="w-4 h-4 text-purple-500 flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-medium text-sm truncate">{v.name}</span>
                <span className="block text-xs text-slate-500">{[v.area, `${formatDistance(miles)} from ${town}`].filter(Boolean).join(' · ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
