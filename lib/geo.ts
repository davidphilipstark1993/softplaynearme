// Geo utilities for distance calculation and postcode handling

export interface Coordinates {
  lat: number
  lng: number
}

export interface GeocodeResult {
  postcode: string
  lat: number
  lng: number
  region?: string
  admin_district?: string
  error?: string
}

// UK postcode regex pattern
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i

/**
 * Validate UK postcode format
 */
export function isValidUKPostcode(postcode: string): boolean {
  return UK_POSTCODE_REGEX.test(postcode.trim())
}

/**
 * Format postcode to standard format (uppercase with space)
 */
export function formatPostcode(postcode: string): string {
  const cleaned = postcode.replace(/\s/g, '').toUpperCase()
  // Insert space before last 3 characters
  if (cleaned.length > 3) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`
  }
  return cleaned
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  from: Coordinates,
  to: Coordinates
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return 'Less than 0.1 miles'
  }
  if (miles < 1) {
    return `${(miles * 10).toFixed(0)}00 ft`
  }
  if (miles < 10) {
    return `${miles.toFixed(1)} miles`
  }
  return `${Math.round(miles)} miles`
}

/**
 * SQL fragment for Haversine distance calculation
 * Use with parameterized queries: $1 = lat, $2 = lng
 */
export const HAVERSINE_SQL = `
  (3959 * acos(
    LEAST(1, GREATEST(-1,
      cos(radians($1)) * cos(radians(lat)) *
      cos(radians(lng) - radians($2)) +
      sin(radians($1)) * sin(radians(lat))
    ))
  ))
`

/**
 * Geocode a UK postcode using postcodes.io API
 */
export async function geocodePostcode(postcode: string): Promise<GeocodeResult> {
  const formatted = postcode.replace(/\s/g, '').toUpperCase()

  if (!isValidUKPostcode(formatted)) {
    return {
      postcode: formatted,
      lat: 0,
      lng: 0,
      error: 'Invalid UK postcode format'
    }
  }

  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(formatted)}`
    )

    if (!response.ok) {
      if (response.status === 404) {
        return {
          postcode: formatted,
          lat: 0,
          lng: 0,
          error: 'Postcode not found'
        }
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 200 || !data.result) {
      return {
        postcode: formatted,
        lat: 0,
        lng: 0,
        error: 'Invalid response from geocoding service'
      }
    }

    return {
      postcode: formatPostcode(formatted),
      lat: data.result.latitude,
      lng: data.result.longitude,
      region: data.result.region,
      admin_district: data.result.admin_district
    }
  } catch (error) {
    return {
      postcode: formatted,
      lat: 0,
      lng: 0,
      error: error instanceof Error ? error.message : 'Geocoding failed'
    }
  }
}

/**
 * Get bounding box for a coordinate with radius
 * Used for initial filtering before precise distance calculation
 */
export function getBoundingBox(
  center: Coordinates,
  radiusMiles: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  // Approximate degrees per mile at UK latitudes
  const latDegPerMile = 1 / 69.0
  const lngDegPerMile = 1 / (69.0 * Math.cos(toRadians(center.lat)))

  return {
    minLat: center.lat - (radiusMiles * latDegPerMile),
    maxLat: center.lat + (radiusMiles * latDegPerMile),
    minLng: center.lng - (radiusMiles * lngDegPerMile),
    maxLng: center.lng + (radiusMiles * lngDegPerMile)
  }
}

/**
 * Parse radius from string, with validation
 */
export function parseRadius(value: string | null | undefined): number {
  if (!value) return 10 // Default 10 miles
  const parsed = parseInt(value, 10)
  if (isNaN(parsed) || parsed < 1) return 10
  if (parsed > 100) return 100 // Max 100 miles
  return parsed
}

/**
 * Available radius options for UI
 */
export const RADIUS_OPTIONS = [
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 20, label: '20 miles' },
  { value: 50, label: '50 miles' }
]
