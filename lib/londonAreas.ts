/**
 * London-specific postcode-to-area mapping for the "Popular areas in London"
 * filter. Only London has enough postcode density and recognisable compass
 * geography (N/NW/E/SE/SW/W/EC/WC plus well-known Greater London border
 * codes) to make an area breakdown meaningful — other cities aren't dense
 * enough yet, so this stays London-only rather than generalising to every
 * city in data/cities.json.
 */

export interface LondonArea {
  slug: string
  name: string
}

export const LONDON_AREAS: LondonArea[] = [
  { slug: 'central-london', name: 'Central London' },
  { slug: 'north-london', name: 'North London' },
  { slug: 'north-west-london', name: 'North West London' },
  { slug: 'east-london', name: 'East London' },
  { slug: 'south-east-london', name: 'South East London' },
  { slug: 'south-west-london', name: 'South West London' },
  { slug: 'west-london', name: 'West London' },
]

// Outward-code prefix -> area slug. Inner London compass prefixes first,
// then Greater London border postcode areas mapped to their nearest
// compass direction (standard Royal Mail postcode-area geography).
const PREFIX_TO_AREA: Record<string, string> = {
  EC: 'central-london',
  WC: 'central-london',
  N: 'north-london',
  EN: 'north-london', // Enfield
  NW: 'north-west-london',
  HA: 'north-west-london', // Harrow
  WD: 'north-west-london', // Watford border
  E: 'east-london',
  IG: 'east-london', // Ilford / Redbridge
  RM: 'east-london', // Romford
  SE: 'south-east-london',
  DA: 'south-east-london', // Dartford / Bexley
  BR: 'south-east-london', // Bromley
  SW: 'south-west-london',
  CR: 'south-west-london', // Croydon
  SM: 'south-west-london', // Sutton
  KT: 'south-west-london', // Kingston
  W: 'west-london',
  TW: 'west-london', // Twickenham / Hounslow
  UB: 'west-london', // Uxbridge / Hillingdon
}

/** Extracts the outward-code prefix (letters before the first digit) from a UK postcode. */
export function getLondonAreaSlug(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const match = postcode.trim().toUpperCase().match(/^([A-Z]{1,2})\d/)
  if (!match) return null
  return PREFIX_TO_AREA[match[1]] || null
}

export function getLondonAreaName(slug: string): string | undefined {
  return LONDON_AREAS.find((a) => a.slug === slug)?.name
}
