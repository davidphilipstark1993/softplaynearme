export interface CompletenessItem {
  key: string
  label: string
  description: string
  done: boolean
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeCompleteness(venue: Record<string, any> | null): CompletenessResult {
  const items: CompletenessItem[] = [
    {
      key: 'address',
      label: 'Confirm your address',
      description: 'Ensure parents can find you on the map',
      done: !!(venue?.address && venue?.postcode),
      weight: 10,
      emoji: '📍',
      actionLabel: 'Confirm address',
      anchor: 'basic',
    },
    {
      key: 'phone',
      label: 'Add a phone number',
      description: 'Parents want to call ahead to check availability',
      done: !!venue?.phone,
      weight: 10,
      emoji: '📞',
      actionLabel: 'Add phone',
      anchor: 'basic',
    },
    {
      key: 'website',
      label: 'Link your website',
      description: 'Drive traffic directly to your booking or info page',
      done: !!venue?.website,
      weight: 5,
      emoji: '🌐',
      actionLabel: 'Add website',
      anchor: 'basic',
    },
    {
      key: 'description',
      label: 'Write a venue description',
      description: 'Tell parents what makes your soft play special',
      done: !!(venue?.description && (venue.description as string).length > 30),
      weight: 15,
      emoji: '📝',
      actionLabel: 'Add description',
      anchor: 'description',
    },
    {
      key: 'hours',
      label: 'Set your opening hours',
      description: 'Appear in "Open Now" searches and show today\'s times',
      done: !!(
        venue?.opening_hours && Object.keys(venue.opening_hours as object || {}).length > 0
      ),
      weight: 15,
      emoji: '🕐',
      actionLabel: 'Update hours',
      anchor: 'hours',
    },
    {
      key: 'facilities',
      label: 'Select your facilities',
      description: 'Café, parking, SEN, parties — help parents filter for you',
      done: !!(
        venue?.cafe ||
        venue?.parking ||
        venue?.parties ||
        venue?.toddler_area ||
        venue?.sen_friendly ||
        venue?.wheelchair_access ||
        venue?.has_outdoor_play
      ),
      weight: 20,
      emoji: '✅',
      actionLabel: 'Add facilities',
      anchor: 'facilities',
    },
    {
      key: 'pricing',
      label: 'Add pricing info',
      description: 'Parents want to know what to budget before visiting',
      done: !!(venue?.price_from || venue?.price_range),
      weight: 15,
      emoji: '💷',
      actionLabel: 'Add prices',
      anchor: 'pricing',
    },
    {
      key: 'photos',
      label: 'Add photos (3+ recommended)',
      description: 'Listings with photos get 3× more clicks from parents',
      done: !!(
        venue?.main_image_url ||
        (Array.isArray(venue?.images) && venue.images.length > 0)
      ),
      weight: 10,
      emoji: '📸',
      actionLabel: 'Add photos',
      anchor: 'photos',
    },
  ]

  const score = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0)
  const missing = items.filter((i) => !i.done)

  return { score, items, missing }
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#16a34a' // green
  if (score >= 50) return '#d97706' // amber
  return '#9333ea'                   // purple (getting started)
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Great listing!'
  if (score >= 50) return 'Looking good — keep going'
  if (score >= 25) return 'Getting started'
  return 'Just getting started'
}
