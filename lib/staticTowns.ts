/**
 * Lightweight towns-only data loader — imports ONLY data/generated/towns.json
 * (38 small entries), never data/generated/venuesByTown.json (the full
 * ~1,800-venue dataset, several MB).
 *
 * This exists specifically so client components (e.g. SearchForm's city
 * autocomplete) can get the town list without pulling the entire venue
 * dataset into the browser bundle. Because JS modules bundle as whole
 * units, a client component importing anything from lib/staticVenues.ts —
 * even just getStaticTowns() — drags in that module's top-level
 * venuesByTownData import too, regardless of whether the function used it.
 * That was shipping ~3MB of dead JS to every homepage visitor and was the
 * dominant cause of a 6-9s LCP / failed-to-idle main thread (see Lighthouse
 * baseline, 2026-08-08).
 *
 * Server components should keep using lib/staticVenues.ts as before —
 * this split only matters for the client bundle.
 */

import townsData from '@/data/generated/towns.json'

export interface StaticTown {
  name: string
  slug: string
  venueCount: number
}

const towns = townsData as unknown as StaticTown[]

export function getStaticTowns(): StaticTown[] {
  return towns
}
