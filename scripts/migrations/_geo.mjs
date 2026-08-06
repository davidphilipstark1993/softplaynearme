// Shared city-mismatch detection for Phase 1 (geographic mis-tagging).
//
// Three independent signals, combined conservatively:
//   1. postcode  — postcode area maps to a declared city other than city_slug (ground truth
//                  when present and unambiguous, e.g. DN -> doncaster).
//   2. slug      — the venue's slug ends "-<other-city-slug>". Slugs are assigned once at
//                  import time (slugify(name) + '-' + citySlugAtImportTime) and never touched
//                  again, so a slug whose city suffix disagrees with the *current* city_slug
//                  is direct evidence that city_slug was changed after the fact (see
//                  scripts/enrich-seo-all.mjs's fixCitySlugs(), which force-moved venues to
//                  'hull' based on a free-text city column regardless of their real location).
//   3. name      — the venue's own name contains another declared city's name
//                  (e.g. "Play Valley Doncaster"). Businesses naming their own city in their
//                  name is a strong signal, but not proof (brand names travel).
//
// Confidence:
//   HIGH   — postcode fires and is unambiguous (single candidate city), OR slug + name both
//            fire and agree on the same single city with no contradicting postcode.
//   MEDIUM — anything else that fired at least one signal: single uncorroborated signal,
//            conflicting signals, or an ambiguous postcode area (e.g. S -> sheffield/barnsley)
//            with no corroboration. Left for manual placement.

export const POSTCODE_TO_CITIES = {
  AB: ['aberdeen'], IV: ['inverness'],
  B: ['birmingham'], BL: ['bolton'], BN: ['brighton'], BS: ['bristol'],
  BD: ['bradford'], HX: ['halifax'], HD: ['huddersfield'],
  CF: ['cardiff'], SA: ['swansea'],
  CO: ['colchester'], IP: ['ipswich'],
  DN: ['doncaster'], S: ['sheffield', 'barnsley'],
  EH: ['edinburgh'], G: ['glasgow'],
  FY: ['blackpool'], PR: ['bolton'],
  HU: ['hull', 'beverley'], YO: ['york', 'bridlington'],
  L: ['liverpool'], M: ['manchester'],
  LE: ['leicester'], LN: ['lincoln'], NG: ['nottingham'],
  LS: ['leeds'],
  E: ['london'], EC: ['london'], N: ['london'], NW: ['london'],
  SE: ['london'], SW: ['london'], W: ['london'], WC: ['london'],
  NE: ['newcastle'], SR: ['sunderland'],
  NR: ['norwich'],
  PO: ['portsmouth'], SO: ['southend'], SS: ['southend'],
  ST: ['stoke'],
  TN: ['hastings'],
}

export function postcodeArea(pc) {
  if (!pc) return null
  const m = String(pc).trim().toUpperCase().match(/^([A-Z]{1,2})\d/)
  return m ? m[1] : null
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Short/hyphenated core word for name matching, e.g. "Stoke-on-Trent" -> "Stoke".
function coreName(name) {
  return name.split(/-on-|-upon-/i)[0].trim()
}

/**
 * @param {{ name: string, slug: string, city_slug: string, postcode: string|null }} v
 * @param {{ slug: string, name: string }[]} cities declared cities (data/cities.json)
 * @returns {null | { confidence: 'HIGH'|'MEDIUM', expected: string|null, candidates: string[], signals: object[] }}
 */
export function detectCityMismatch(v, cities) {
  // Postcode is ground truth when present and parseable. If it already
  // confirms the current city_slug, the venue is correctly placed — full
  // stop, regardless of what a leftover slug suffix or a franchise-brand name
  // (e.g. "Oxygen York" physically in London — a chain name, not a location)
  // might otherwise suggest. Without this short-circuit, a venue correctly
  // postcode-moved away from a city can get immediately re-flagged by its own
  // stale "-york" slug/name and bounced back.
  if (v.postcode && String(v.postcode).trim()) {
    const area = postcodeArea(v.postcode)
    const expected = area ? POSTCODE_TO_CITIES[area] : null
    if (expected && expected.includes(v.city_slug)) {
      return null
    }
  }

  const signals = []

  // 1. Postcode
  let postcodeExpected = null
  if (v.postcode && String(v.postcode).trim()) {
    const area = postcodeArea(v.postcode)
    const expected = area ? POSTCODE_TO_CITIES[area] : null
    if (expected && !expected.includes(v.city_slug)) {
      postcodeExpected = expected
      signals.push({ type: 'postcode', expected, detail: `postcode ${v.postcode} (area ${area}) -> ${expected.join('/')}` })
    }
  }

  // 2. Slug suffix
  let slugExpected = null
  const slugLower = (v.slug || '').toLowerCase()
  for (const c of cities) {
    if (c.slug === v.city_slug) continue
    if (slugLower.endsWith(`-${c.slug}`)) {
      slugExpected = c.slug
      signals.push({ type: 'slug', expected: [c.slug], detail: `slug ends "-${c.slug}"` })
      break
    }
  }

  // 3. Name substring
  let nameExpected = null
  for (const c of cities) {
    if (c.slug === v.city_slug) continue
    const word = coreName(c.name)
    const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'i')
    if (re.test(v.name)) {
      nameExpected = c.slug
      signals.push({ type: 'name', expected: [c.slug], detail: `name contains "${word}"` })
      break
    }
  }

  if (!signals.length) return null

  // HIGH: unambiguous postcode overrides everything else.
  if (postcodeExpected && postcodeExpected.length === 1) {
    return { confidence: 'HIGH', expected: postcodeExpected[0], candidates: postcodeExpected, signals }
  }

  // HIGH: slug + name agree on one city, and postcode (if present) doesn't contradict it.
  if (slugExpected && nameExpected && slugExpected === nameExpected) {
    if (!postcodeExpected || postcodeExpected.includes(slugExpected)) {
      return { confidence: 'HIGH', expected: slugExpected, candidates: [slugExpected], signals }
    }
  }

  // Everything else: collect all candidate cities mentioned across signals for manual review.
  const candidateSet = new Set()
  for (const s of signals) for (const c of s.expected) candidateSet.add(c)
  const candidates = [...candidateSet]
  return {
    confidence: 'MEDIUM',
    expected: candidates.length === 1 ? candidates[0] : null,
    candidates,
    signals,
  }
}
