// Which city hub a venue belongs in, from the venue's OWN location — never from
// the city that was being searched or the CSV file it came in.
//
// The old importers stamped city_slug with the search city ("found while
// searching Nottingham" -> /soft-play/nottingham/... for a Derby venue). Every
// importer and the city-reassignment planner use this module so the rule is the
// same everywhere.
//
// Evidence (postcodes.io, public, no key):
//   postcode lookup -> lat/lng, bua (built-up area = the town it is in), parish,
//   admin_district, ttwa (travel-to-work area = wider catchment). No usable
//   postcode -> reverse-geocode the venue's lat/lng to its nearest postcode.
// Hub centres: data/hub-centres.json (OS Open Names), written by
//   scripts/plan-city-reassignment.mjs --write-centres.
//
// Order:
//   1. locality : bua / parish / district names a hub within 25 km    -> that hub
//   2. keep     : (existing venues only) stored hub is the ttwa hub, or no more than
//                 5 km / 1.25x further than the nearest hub          -> stay put
//   3. ttwa     : ttwa names a hub within 25 km                       -> that hub
//   4. nearest  : nearest hub within 40 km
//   5. none     : nothing within 40 km
import fs from 'fs'
import path from 'path'

export const NONE_KM = 40
export const LOCALITY_MAX_KM = 25
export const KEEP_EXTRA_KM = 5
export const KEEP_RATIO = 1.25
export const COORD_CONFLICT_KM = 10

export function km(a, b) {
  const R = 6371, r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const normName = (s) => String(s ?? '').toLowerCase()
  .replace(/, unparished area$/, '').replace(/^city of /, '').replace(/, city of$/, '')
  .replace(/\b(city|county|borough|district|town)\b/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

export const normPostcode = (pc) => {
  const c = String(pc ?? '').toUpperCase().replace(/\s+/g, '')
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(c) ? c : null
}

/** ONS/OS spell some hub towns differently from our hub names. */
export const OS_NAME = { hull: 'Kingston upon Hull', newcastle: 'Newcastle upon Tyne', stoke: 'Stoke-on-Trent', southend: 'Southend-on-Sea' }
const ALIASES = { 'kingston upon hull': 'hull', 'stoke on trent': 'stoke', 'newcastle upon tyne': 'newcastle', 'southend on sea': 'southend', 'brighton and hove': 'brighton' }

/**
 * Every /soft-play/{city} page that renders: data/cities.json plus the static town
 * buckets. Centres come from data/hub-centres.json; a hub without one can still be
 * matched by name (locality/ttwa) but not by distance.
 */
export function loadHubs(root) {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'))
  const hubs = new Map()
  for (const c of read('data/cities.json')) hubs.set(c.slug, { slug: c.slug, name: c.name, county: c.county ?? null, region: c.region ?? null })
  for (const t of Object.values(read('data/generated/venuesByTown.json'))) {
    if (!hubs.has(t.townSlug)) hubs.set(t.townSlug, { slug: t.townSlug, name: t.town, county: null, region: null })
  }
  const centresFile = path.join(root, 'data/hub-centres.json')
  const centres = fs.existsSync(centresFile) ? JSON.parse(fs.readFileSync(centresFile, 'utf8')) : {}
  for (const h of hubs.values()) {
    const c = centres[h.slug]
    if (c) { h.centre = { lat: c.lat, lng: c.lng }; h.centreSource = c.source }
  }
  return hubs
}

export function hubsMissingCentres(hubs) {
  return [...hubs.values()].filter((h) => !h.centre).map((h) => h.slug)
}

async function postJson(url, body) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return res.json()
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
  }
  throw new Error(`postcodes.io request failed: ${url}`)
}
const pickGeo = (r) => r && ({ lat: r.latitude, lng: r.longitude, bua: r.bua, parish: r.parish, district: r.admin_district, ttwa: r.ttwa, postcode: r.postcode })
const llKey = (v) => `${(+v.lat).toFixed(5)},${(+v.lng).toFixed(5)}`

/**
 * Look up location evidence for many venues in bulk ({postcode, lat, lng} each).
 * `cache` ({pc:{}, rev:{}}) is filled in place so callers can persist it.
 * Returns an array parallel to `venues`: { pc, rev } (either may be null).
 */
export async function lookupLocations(venues, cache = { pc: {}, rev: {} }, onBatch = () => {}) {
  cache.pc ??= {}; cache.rev ??= {}
  const needPc = [...new Set(venues.map((v) => normPostcode(v.postcode)).filter((p) => p && !(p in cache.pc)))]
  for (let i = 0; i < needPc.length; i += 100) {
    const res = await postJson('https://api.postcodes.io/postcodes', { postcodes: needPc.slice(i, i + 100) })
    for (const r of res.result) cache.pc[normPostcode(r.query)] = pickGeo(r.result) ?? null
    onBatch(cache)
  }
  const needRev = venues.filter((v) => v.lat != null && v.lng != null && !(llKey(v) in cache.rev))
  const uniq = [...new Map(needRev.map((v) => [llKey(v), v])).values()]
  for (let i = 0; i < uniq.length; i += 100) {
    const batch = uniq.slice(i, i + 100)
    const res = await postJson('https://api.postcodes.io/postcodes', {
      geolocations: batch.map((v) => ({ latitude: +v.lat, longitude: +v.lng, radius: 2000, limit: 1 })),
    })
    res.result.forEach((r, j) => { cache.rev[llKey(batch[j])] = pickGeo(r.result?.[0]) ?? null })
    onBatch(cache)
  }
  return venues.map((v) => {
    const key = normPostcode(v.postcode)
    return { pc: key ? cache.pc[key] ?? null : null, rev: v.lat != null && v.lng != null ? cache.rev[llKey(v)] ?? null : null }
  })
}

/**
 * Pure decision. `venue`: { postcode, lat, lng, address }. `loc`: from lookupLocations.
 * `storedCity`: the venue's current city_slug, or null for a new venue (no "keep" step).
 * Returns { derived, method, confidence: 'high'|'medium'|'low', flags[], geo, storedKm }.
 * `derived` is a hub slug or 'none'.
 */
export function decideCity(venue, loc, hubs, storedCity = null) {
  const pcKey = normPostcode(venue.postcode)
  const pc = loc?.pc ?? null
  const geo = pc ?? loc?.rev ?? null
  const hasLL = venue.lat != null && venue.lng != null
  const pos = pc ? { lat: pc.lat, lng: pc.lng } : hasLL ? { lat: +venue.lat, lng: +venue.lng } : null
  const flags = []
  if (pcKey && !pc) flags.push('postcode-not-found')
  if (!pcKey && venue.postcode && String(venue.postcode).trim()) flags.push('postcode-malformed')
  if (pc && hasLL) {
    const d = km(pc, { lat: +venue.lat, lng: +venue.lng })
    if (d > COORD_CONFLICT_KM) flags.push(`postcode-vs-latlng ${d.toFixed(0)}km`)
  }
  const conflict = flags.some((f) => f.startsWith('postcode-vs-latlng'))
  const stored = storedCity ? hubs.get(storedCity) : null
  if (storedCity && !stored) flags.push('stored-city-has-no-hub-page')

  const dists = pos ? [...hubs.values()].filter((h) => h.centre).map((h) => ({ h, d: km(pos, h.centre) })).sort((a, b) => a.d - b.d) : []
  const nearest = dists[0], second = dists[1]
  const dTo = (slug) => dists.find((x) => x.h.slug === slug)?.d
  const storedKm = storedCity ? dTo(storedCity) : undefined

  const byName = new Map([...hubs.values()].map((h) => [normName(h.name), h]))
  const hubForName = (n) => {
    const k = normName(n)
    if (!k) return null
    if (ALIASES[k] && hubs.has(ALIASES[k])) return hubs.get(ALIASES[k])
    return byName.get(k) ?? null
  }
  // A name only counts if that hub is actually near (Hatfield, Doncaster is not the Hatfield, Herts hub).
  const nearHub = (n, max) => { const h = hubForName(n); return h && (dTo(h.slug) == null || dTo(h.slug) <= max) ? h : null }

  const locField = geo && ['bua', 'parish', 'district'].find((f) => nearHub(geo[f], LOCALITY_MAX_KM))
  const locHub = locField ? nearHub(geo[locField], LOCALITY_MAX_KM) : null
  const ttwaHub = geo ? nearHub(geo.ttwa, LOCALITY_MAX_KM) : null
  const fmt = (d) => (d == null ? '?' : d.toFixed(1))

  const out = (derived, method, confidence) => ({ derived, method, confidence, flags, geo, storedKm })

  if (locHub) {
    return out(locHub.slug, `locality: ${locField} "${geo[locField]}" (${fmt(dTo(locHub.slug))}km)`, conflict ? 'low' : 'high')
  }
  if (stored && nearest && storedKm != null) {
    const isTtwa = storedCity === ttwaHub?.slug
    const tolerable = storedKm <= NONE_KM && (storedKm <= nearest.d + KEEP_EXTRA_KM || storedKm <= nearest.d * KEEP_RATIO)
    if (isTtwa || tolerable) {
      const clearlyNearer = storedKm > nearest.d + KEEP_EXTRA_KM
      if (clearlyNearer) flags.push(`nearer hub: ${nearest.h.slug} ${fmt(nearest.d)}km`)
      return out(storedCity,
        isTtwa ? `keep: stored hub is travel-to-work area "${geo.ttwa}" (${fmt(storedKm)}km)` : `keep: stored hub ${fmt(storedKm)}km vs nearest ${nearest.h.slug} ${fmt(nearest.d)}km`,
        conflict ? 'low' : clearlyNearer ? 'medium' : 'high')
    }
  }
  if (ttwaHub && dTo(ttwaHub.slug) != null) {
    return out(ttwaHub.slug, `ttwa "${geo.ttwa}" (${fmt(dTo(ttwaHub.slug))}km)`, conflict ? 'low' : 'medium')
  }
  if (nearest && nearest.d <= NONE_KM) {
    const clear = !second || second.d >= nearest.d * 1.3
    return out(nearest.h.slug, `nearest-hub ${fmt(nearest.d)}km` + (second ? ` (next ${second.h.slug} ${fmt(second.d)}km)` : ''),
      conflict || !clear || nearest.d > 25 ? 'low' : 'medium')
  }
  if (nearest) return out('none', `none: nearest hub ${nearest.h.slug} ${fmt(nearest.d)}km`, 'low')
  if (venue.address) {
    const hit = [...hubs.values()]
      .filter((h) => new RegExp(`\\b${h.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(venue.address))
      .sort((a, b) => b.name.length - a.name.length)[0]
    if (hit) return out(hit.slug, `address-text "${hit.name}"`, 'low')
  }
  return out(storedCity ?? 'none', storedCity ? 'no-location: keep stored' : 'no-location', 'low')
}

/**
 * For importers: the hub a NEW venue should be filed under. Falls back to
 * `fallbackCity` (the search/file city) only when the venue has no usable
 * location at all, and says so, so the caller can flag it for review.
 */
export async function cityForNewVenue(venue, hubs, fallbackCity, cache) {
  const [loc] = await lookupLocations([venue], cache)
  const r = decideCity(venue, loc, hubs, null)
  if (r.derived === 'none' || r.method === 'no-location') {
    return { ...r, citySlug: r.derived === 'none' ? null : fallbackCity, needsReview: true }
  }
  return { ...r, citySlug: r.derived, needsReview: r.confidence === 'low' }
}
