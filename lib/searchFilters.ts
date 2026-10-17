/**
 * The /search page grew two URL styles for the same filters:
 *   /search?filters=toddler            (old; linked from the homepage and copy)
 *   /search?age=toddler                (structured; what the filter sidebar writes)
 * Only the structured form was ever read, so the old links silently showed an
 * unfiltered page. This folds the old form into the structured one.
 */
const LEGACY: Record<string, { param: 'age' | 'facilities' | 'special'; value: string }> = {
  toddler: { param: 'age', value: 'toddler' },
  parties: { param: 'facilities', value: 'parties' },
  sen: { param: 'facilities', value: 'sen' },
  cafe: { param: 'facilities', value: 'cafe' },
  parking: { param: 'facilities', value: 'parking' },
  open_now: { param: 'special', value: 'open-now' },
  'open-now': { param: 'special', value: 'open-now' },
}

/** Returns a copy of `params` with any `filters=` values moved into age / facilities / special. */
export function mergeLegacyFilters(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params.toString())
  const legacy = (out.get('filters') || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!out.has('filters')) return out
  out.delete('filters')
  for (const key of legacy) {
    const target = LEGACY[key]
    if (!target) continue
    const current = (out.get(target.param) || '').split(',').filter(Boolean)
    if (!current.includes(target.value)) out.set(target.param, [...current, target.value].join(','))
  }
  return out
}

/** A /search URL is a plain, indexable landing page only when it carries no query at all. */
export function hasSearchQuery(params: Record<string, string | string[] | undefined>): boolean {
  return Object.values(params).some((v) => (Array.isArray(v) ? v.length > 0 : !!v))
}
