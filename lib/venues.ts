/**
 * Venue and City configuration for Soft Play Near Me
 * Single source of truth for all soft play centre directory pages
 */

export interface CityConfig {
  slug: string
  name: string
  county: string
  region?: string
  metaTitle: string
  metaDescription: string
  h1: string
  intro: string
  nearbyAreas: string[]
  faqs: {
    question: string
    answer: string
  }[]
}

/**
 * Region lookup — maps counties to broader regions for content generation
 */
export const REGIONS: { region: string; counties: string[] }[] = [
  { region: 'Yorkshire', counties: ['East Yorkshire', 'North Yorkshire', 'West Yorkshire', 'South Yorkshire'] },
  { region: 'North East', counties: ['County Durham', 'Northumberland', 'Tyne and Wear'] },
  { region: 'North West', counties: ['Greater Manchester', 'Merseyside', 'Lancashire', 'Cheshire', 'Cumbria'] },
  { region: 'East Midlands', counties: ['Derbyshire', 'Nottinghamshire', 'Leicestershire', 'Lincolnshire', 'Northamptonshire'] },
  { region: 'West Midlands', counties: ['West Midlands', 'Staffordshire', 'Warwickshire', 'Worcestershire', 'Shropshire'] },
  { region: 'South East', counties: ['Kent', 'Surrey', 'Sussex', 'Hampshire', 'Berkshire', 'Oxfordshire', 'Buckinghamshire'] },
  { region: 'South West', counties: ['Devon', 'Cornwall', 'Somerset', 'Dorset', 'Gloucestershire', 'Wiltshire', 'Bristol'] },
  { region: 'East of England', counties: ['Norfolk', 'Suffolk', 'Essex', 'Cambridgeshire', 'Hertfordshire', 'Bedfordshire'] },
  { region: 'London', counties: ['Greater London'] },
]

export function getRegionForCounty(county: string): string | undefined {
  return REGIONS.find(r => r.counties.includes(county))?.region
}

export interface FilterConfig {
  slug: string
  name: string
  dbColumn: string
  metaTitleTemplate: string
  metaDescriptionTemplate: string
  h1Template: string
  introTemplate: string
}

// Available amenity filters
export const filters: FilterConfig[] = [
  {
    slug: 'toddler',
    name: 'Toddler Friendly',
    dbColumn: 'toddler_area',
    metaTitleTemplate: 'Toddler Soft Play in {city} | Under 3s & Baby Friendly',
    metaDescriptionTemplate: 'Find toddler-friendly soft play centres in {city} with dedicated baby and under 3s areas. Safe play spaces for your little ones.',
    h1Template: 'Toddler Soft Play in {city}',
    introTemplate: 'Looking for soft play suitable for babies and toddlers in {city}? These venues have dedicated areas for under 3s with age-appropriate equipment.',
  },
  {
    slug: 'birthday-parties',
    name: 'Birthday Parties',
    dbColumn: 'parties',
    metaTitleTemplate: 'Soft Play Birthday Parties in {city} | Party Venues',
    metaDescriptionTemplate: 'Book the perfect soft play birthday party in {city}. Compare venues with party packages, food options, and private hire.',
    h1Template: 'Soft Play Birthday Parties in {city}',
    introTemplate: 'Planning a birthday party in {city}? These soft play centres offer party packages, dedicated party rooms, and catering options.',
  },
  {
    slug: 'sen-friendly',
    name: 'SEN Friendly',
    dbColumn: 'sen_friendly',
    metaTitleTemplate: 'SEN Friendly Soft Play in {city} | Sensory Friendly Venues',
    metaDescriptionTemplate: 'Find SEN-friendly soft play centres in {city} with quiet sessions, sensory rooms, and trained staff for children with additional needs.',
    h1Template: 'SEN Friendly Soft Play in {city}',
    introTemplate: 'These soft play centres in {city} cater to children with special educational needs and disabilities, offering quieter sessions and sensory-friendly facilities.',
  },
  {
    slug: 'open-now',
    name: 'Open Now',
    dbColumn: null, // Computed from opening_hours
    metaTitleTemplate: 'Soft Play Open Now in {city} | Open Today',
    metaDescriptionTemplate: 'Find soft play centres open right now in {city}. Check opening times and visit today.',
    h1Template: 'Soft Play Open Now in {city}',
    introTemplate: 'Looking for somewhere to take the kids right now? Here are soft play centres currently open in {city}.',
  },
]

// City configurations — loaded from data/cities.json for easy bulk editing
import citiesData from '@/data/cities.json'
export const cities: CityConfig[] = citiesData as CityConfig[]

/**
 * Get all city slugs for static generation
 */
export function getAllCitySlugs(): string[] {
  return cities.map((city) => city.slug)
}

/**
 * Get city config by slug
 */
export function getCityBySlug(slug: string): CityConfig | undefined {
  return cities.find((city) => city.slug === slug)
}

/**
 * Get filter config by slug
 */
export function getFilterBySlug(slug: string): FilterConfig | undefined {
  return filters.find((filter) => filter.slug === slug)
}

/**
 * Get nearby cities
 */
export function getNearbyCities(citySlug: string): CityConfig[] {
  const city = getCityBySlug(citySlug)
  if (!city) return []

  return city.nearbyAreas
    .map((area) => cities.find((c) => c.name.toLowerCase() === area.toLowerCase()))
    .filter((c): c is CityConfig => c !== undefined)
}
