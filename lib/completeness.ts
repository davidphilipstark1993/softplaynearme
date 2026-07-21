// ─── Types ─────────────────────────────────────────────────────────────────

export interface CompletenessItem {
  key: string
  label: string
  description: string
  done: boolean
  /** Partial credit: 0–weight depending on progress */
  score: number
  weight: number
  emoji: string
  actionLabel: string
  anchor: string
}

export interface CompletenessResult {
  score: number
  items: CompletenessItem[]
  missing: CompletenessItem[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function wordCount(text: string | null | undefined): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function countFacilities(venue: Record<string, unknown>): number {
  const booleanKeys = [
    'cafe', 'parking', 'parties', 'toddler_area', 'baby_area',
    'sen_friendly', 'wheelchair_access', 'has_outdoor_play', 'free_wifi',
    'air_conditioning', 'party_rooms', 'food_served', 'changing_facilities', 'role_play_area',
  ]
  return booleanKeys.filter((k) => venue[k]).length
}

function countPhotos(venue: Record<string, unknown>): number {
  let count = 0
  if (venue.main_image_url) count++
  if (Array.isArray(venue.photo_urls)) {
    count += (venue.photo_urls as string[]).filter(Boolean).length
  }
  if (Array.isArray(venue.images)) {
    count += (venue.images as string[]).filter(Boolean).length
  }
  return count
}

function countDaysOpen(opening_hours: unknown): number {
  if (!opening_hours || typeof opening_hours !== 'object') return 0
  return Object.values(opening_hours as Record<string, unknown>).filter((v) => v !== null).length
}

function hasPricing(venue: Record<string, unknown>): boolean {
  if (venue.price_from) return true
  if (Array.isArray(venue.session_pricing) && (venue.session_pricing as unknown[]).length > 0) return true
  return false
}

// ─── Main export ─────────────────────────────────────────────────────────────
//
// Weight breakdown (totals 100%):
//   Basic info (address + phone + website)  20%
//   Opening hours (3+ days set)             20%
//   Facilities (3+ selected)                15%
//   Pricing (1+ session or price_from)      15%
//   Description (80+ words)                 10%
//   Photos (3+ images)                      20%

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeCompleteness(venue: Record<string, any> | null): CompletenessResult {
  const v = venue || {}

  // ── Basic info (20% total, split across 3 sub-items) ──────────────────────
  const hasAddress = !!(v.address && v.postcode)
  const hasPhone = !!v.phone
  const hasWebsite = !!v.website

  // ── Description (10%) ─────────────────────────────────────────────────────
  const words = wordCount(v.description)
  const descDone = words >= 80
  // Partial credit: 1 word = 1%, capped at full 10%
  const descPartial = Math.min(10, Math.floor((words / 80) * 10))

  // ── Opening hours (20%) ───────────────────────────────────────────────────
  const daysOpen = countDaysOpen(v.opening_hours)
  const hoursDone = daysOpen >= 3
  // Partial: each day = 20/7 ≈ 2.86 → round down
  const hoursPartial = Math.min(20, Math.floor((daysOpen / 7) * 20))

  // ── Facilities (15%) ──────────────────────────────────────────────────────
  const facilityCount = countFacilities(v)
  const facilitiesDone = facilityCount >= 3
  // Partial: each facility adds 15/10 = 1.5
  const facilitiesPartial = Math.min(15, Math.floor((facilityCount / 10) * 15))

  // ── Pricing (15%) ─────────────────────────────────────────────────────────
  const pricingDone = hasPricing(v)

  // ── Photos (20%) ──────────────────────────────────────────────────────────
  const photoCount = countPhotos(v)
  const photosDone = photoCount >= 3
  // Partial: each photo = 20/3 ≈ 6.67
  const photosPartial = Math.min(20, Math.floor((photoCount / 3) * 20))

  const items: CompletenessItem[] = [
    {
      key: 'address',
      label: 'Confirm your address & postcode',
      description: 'Ensure parents can find you on the map and in local searches',
      done: hasAddress,
      score: hasAddress ? 8 : 0,
      weight: 8,
      emoji: '📍',
      actionLabel: 'Confirm address',
      anchor: 'basic',
    },
    {
      key: 'phone',
      label: 'Add a phone number',
      description: 'Parents want to call ahead — this drives direct bookings',
      done: hasPhone,
      score: hasPhone ? 7 : 0,
      weight: 7,
      emoji: '📞',
      actionLabel: 'Add phone',
      anchor: 'basic',
    },
    {
      key: 'website',
      label: 'Link your website',
      description: 'Drive traffic directly to your booking or info page',
      done: hasWebsite,
      score: hasWebsite ? 5 : 0,
      weight: 5,
      emoji: '🌐',
      actionLabel: 'Add website',
      anchor: 'basic',
    },
    {
      key: 'description',
      label: `Write a venue description (${words}/80 words)`,
      description: 'A great description helps parents decide — and boosts your search ranking',
      done: descDone,
      score: descPartial,
      weight: 10,
      emoji: '📝',
      actionLabel: 'Write description',
      anchor: 'description',
    },
    {
      key: 'hours',
      label: `Set opening hours (${daysOpen}/7 days)`,
      description: 'Appear in "Open Now" searches — essential for weekend families',
      done: hoursDone,
      score: hoursPartial,
      weight: 20,
      emoji: '🕐',
      actionLabel: 'Update hours',
      anchor: 'hours',
    },
    {
      key: 'facilities',
      label: `Select facilities (${facilityCount} selected, 3+ recommended)`,
      description: 'Café, parking, SEN, parties — parents filter by these every day',
      done: facilitiesDone,
      score: facilitiesPartial,
      weight: 15,
      emoji: '✅',
      actionLabel: 'Add facilities',
      anchor: 'facilities',
    },
    {
      key: 'pricing',
      label: 'Add pricing & session types',
      description: 'The #1 question parents have before visiting — answer it upfront',
      done: pricingDone,
      score: pricingDone ? 15 : 0,
      weight: 15,
      emoji: '💷',
      actionLabel: 'Add prices',
      anchor: 'pricing',
    },
    {
      key: 'photos',
      label: `Add photos (${photoCount}/3 uploaded)`,
      description: 'Listings with 3+ photos get 3× more clicks — this is the biggest win',
      done: photosDone,
      score: photosPartial,
      weight: 20,
      emoji: '📸',
      actionLabel: 'Add photos',
      anchor: 'photos',
    },
  ]

  const score = items.reduce((s, i) => s + i.score, 0)
  const missing = items.filter((i) => !i.done)

  return { score, items, missing }
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a' // green
  if (score >= 50) return '#d97706' // amber
  return '#9333ea'                   // purple
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Great listing — ranking well'
  if (score >= 60) return 'Looking good — almost there'
  if (score >= 40) return 'Good start — keep going'
  return 'Just getting started'
}

export function scoreSublabel(score: number): string {
  if (score >= 80) return 'Your listing appears higher in parent searches'
  if (score >= 60) return 'A few more steps and you\'ll rank in the top results'
  if (score >= 40) return 'Complete your listing to appear higher and get more visits'
  return 'Complete your listing → appear higher in searches and get more bookings from parents'
}
