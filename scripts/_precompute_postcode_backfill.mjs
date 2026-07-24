import { readFileSync, writeFileSync } from 'fs'

const findings = JSON.parse(readFileSync('data/_audit_findings.json', 'utf-8'))
const venues = JSON.parse(readFileSync('data/generated/venues.json', 'utf-8'))
const bySlug = new Map(venues.map((v) => [v.townSlug + '|' + v.slug, v]))

const targets = findings.noPostcode
  .map((np) => bySlug.get(np.town + '|' + np.slug))
  .filter((v) => v && v.lat && v.lng)

console.log('Targets with lat/lng:', targets.length)

const results = []
const CHUNK = 100
for (let i = 0; i < targets.length; i += CHUNK) {
  const chunk = targets.slice(i, i + CHUNK)
  const body = {
    geolocations: chunk.map((v) => ({
      longitude: Number(v.lng),
      latitude: Number(v.lat),
      radius: 1000,
      limit: 1,
    })),
  }
  const res = await fetch('https://api.postcodes.io/postcodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.status !== 200) {
    console.error('API error on chunk', i, JSON.stringify(data).slice(0, 300))
    continue
  }
  data.result.forEach((entry, j) => {
    const v = chunk[j]
    const match = entry.result?.[0]
    results.push({
      townSlug: v.townSlug,
      slug: v.slug,
      name: v.name,
      id: v.id,
      lat: v.lat,
      lng: v.lng,
      postcode: match?.postcode ?? null,
      distanceNote: match ? undefined : 'no postcode found within 1km',
    })
  })
  console.log(`processed ${Math.min(i + CHUNK, targets.length)}/${targets.length}`)
}

const found = results.filter((r) => r.postcode).length
console.log(`\nResolved postcodes for ${found}/${results.length}`)
writeFileSync('data/_postcode_backfill.json', JSON.stringify(results, null, 2))
console.log('Written to data/_postcode_backfill.json')
