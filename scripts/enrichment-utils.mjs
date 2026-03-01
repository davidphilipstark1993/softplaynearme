const UK_POSTCODE_REGEX = /^([Gg][Ii][Rr]\s?0[Aa]{2}|(?:[A-Za-z][0-9]{1,2}|[A-Za-z][A-Ha-hJ-Yj-y][0-9]{1,2}|[A-Za-z][0-9][A-Za-z]|[A-Za-z][A-Ha-hJ-Yj-y][0-9][A-Za-z])\s?[0-9][A-Za-z]{2})$/

const FACILITY_KEYWORDS = {
  cafe: ['cafe', 'café', 'coffee', 'food', 'restaurant', 'snack', 'refreshment'],
  toddler_zone: ['toddler', 'under 3', 'under-3', 'under 4', 'under-4', 'little ones', '0-3'],
  baby_change: ['baby change', 'changing facility', 'nappy changing'],
  sensory_sessions: ['sensory', 'sen session', 'autism', 'quiet session', 'additional needs', 'sen-friendly'],
  parties: ['party', 'birthday package', 'party room', 'private hire'],
  parking: ['parking', 'car park', 'free parking'],
  accessibility: ['wheelchair', 'step-free', 'accessible toilet', 'disabled access'],
  wifi: ['wifi', 'wi-fi', 'free internet'],
  outdoor_play: ['outdoor play', 'outside play', 'outdoor area'],
  role_play: ['role play', 'imaginative play', 'pretend play'],
  trampoline: ['trampoline', 'bounce park'],
}

function normalizeWhitespace(input) {
  return String(input || '').replace(/\s+/g, ' ').trim()
}

export function normalizeText(input) {
  return normalizeWhitespace(String(input || '').replace(/^"+|"+$/g, ''))
}

export function validateUkPostcode(postcode) {
  const candidate = normalizeText(postcode).toUpperCase()
  if (!candidate) return false
  return UK_POSTCODE_REGEX.test(candidate)
}

export function normalizeUkPostcode(postcode) {
  const candidate = normalizeText(postcode).toUpperCase().replace(/\s+/g, '')
  if (!candidate) return ''
  if (!validateUkPostcode(candidate)) return ''
  return `${candidate.slice(0, -3)} ${candidate.slice(-3)}`
}

export function normalizePhoneUk(input) {
  const raw = normalizeText(input)
  if (!raw) return ''

  const plus = raw.startsWith('+')
  let digits = raw.replace(/[^\d]/g, '')

  if (plus) {
    if (digits.startsWith('44')) return `+${digits}`
    return `+${digits}`
  }

  if (digits.startsWith('0044')) digits = `44${digits.slice(4)}`
  if (digits.startsWith('44')) return `+${digits}`
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`
  return digits ? `+44${digits}` : ''
}

export function normalizeUrl(input) {
  const raw = normalizeText(input)
  if (!raw) return ''
  let candidate = raw
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`
  try {
    const u = new URL(candidate)
    u.hash = ''
    return u.toString()
  } catch {
    return ''
  }
}

export function extractFacilitiesFromText(text) {
  const haystack = normalizeText(text).toLowerCase()
  const facilities = []
  for (const [facility, keywords] of Object.entries(FACILITY_KEYWORDS)) {
    if (keywords.some((word) => haystack.includes(word))) facilities.push(facility)
  }
  return facilities.sort()
}

function isMeaningful(value) {
  if (value == null) return false
  if (typeof value === 'string') return normalizeText(value).length > 0
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function isClearlyWrong(field, value) {
  if (!isMeaningful(value)) return true
  if (field === 'postcode') return !validateUkPostcode(value)
  return false
}

export function computePatch(existing, candidate) {
  const patch = {}
  for (const [key, nextValue] of Object.entries(candidate)) {
    const prevValue = existing[key]
    if (!isMeaningful(nextValue)) continue

    if (!isMeaningful(prevValue)) {
      patch[key] = nextValue
      continue
    }

    if (isClearlyWrong(key, prevValue) && !isClearlyWrong(key, nextValue)) {
      patch[key] = nextValue
      continue
    }

    if (key === 'facilities' && Array.isArray(prevValue) && Array.isArray(nextValue)) {
      const union = [...new Set([...prevValue, ...nextValue])]
      if (union.length !== prevValue.length) patch[key] = union
      continue
    }

    if (key === 'source_urls' && Array.isArray(prevValue) && Array.isArray(nextValue)) {
      const union = [...new Set([...prevValue, ...nextValue])]
      if (union.length !== prevValue.length) patch[key] = union
      continue
    }
  }
  return patch
}

export function diffObject(before, patch) {
  const changes = []
  for (const [key, value] of Object.entries(patch)) {
    changes.push({ field: key, from: before[key] ?? null, to: value ?? null })
  }
  return changes
}

export function toSlug(input) {
  return normalizeText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function htmlToText(html) {
  const withoutScript = String(html || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return normalizeWhitespace(
    withoutScript
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  )
}

export function extractEmails(text) {
  const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
  return [...new Set(matches.map((v) => v.toLowerCase()))]
}

export function extractPhones(text) {
  const matches = String(text || '').match(/(?:\+44\s?7\d{3}|0\d{4}|0\d{3}|0\d{2})[\s\d]{6,10}/g) || []
  return [...new Set(matches.map(normalizePhoneUk).filter(Boolean))]
}

export function extractLikelyPostcode(text) {
  const match = String(text || '').match(/[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}/i)
  return match ? normalizeUkPostcode(match[0]) : ''
}

export function extractOpeningHoursText(text) {
  const snippets = []
  const regex = /((monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^\n\r.;:]{0,120}(\d{1,2}[:.]\d{2}|closed))/gi
  let m
  while ((m = regex.exec(String(text || ''))) && snippets.length < 7) {
    snippets.push(normalizeWhitespace(m[1]))
  }
  return snippets.join('; ')
}

export function buildDescription(facts) {
  const lines = []
  if (facts.address || facts.city) {
    lines.push(`${facts.name} is an indoor soft play venue${facts.city ? ` in ${facts.city}` : ''}${facts.address ? ` at ${facts.address}` : ''}.`)
  }
  if (facts.facilities?.length) {
    lines.push(`Facilities listed include ${facts.facilities.slice(0, 6).join(', ')}.`)
  }
  if (facts.partyInfo) {
    lines.push('Party bookings are available according to the venue information currently published online.')
  }
  return lines.slice(0, 3).join(' ')
}

export function scoreConfidence(signals) {
  let score = 0
  if (signals.placeIdMatch) score += 0.65
  if (signals.mapsUrlPresent) score += 0.15
  if (signals.phoneMatch) score += 0.2
  if (signals.postcodeMatch) score += 0.2
  if (signals.websiteFetched) score += 0.15
  if (signals.validAddressPostcode) score += 0.15
  if (signals.geocodeResolved) score += 0.15
  if (signals.officialWebsiteDomain) score += 0.15
  return Math.min(1, score)
}
