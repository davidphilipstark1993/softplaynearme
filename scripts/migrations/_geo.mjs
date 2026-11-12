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
  // Greater West Midlands satellite towns with no declared city of their own
  // — nearest declared city is Birmingham, same precedent as PR->bolton and
  // HD->huddersfield below.
  WS: ['birmingham'], WV: ['birmingham'], DY: ['birmingham'], TF: ['birmingham'],
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

export function postcodeDistrict(pc) {
  if (!pc) return null
  const m = String(pc).trim().toUpperCase().match(/^([A-Z]{1,2}\d{1,2})[A-Z]?\s*\d[A-Z]{2}$/)
  return m ? m[1] : null
}

// District-level overrides for areas where a single postcode-area letter
// (HU, YO, S) genuinely spans multiple declared cities and the area-level
// table alone leaves it ambiguous. Real Royal Mail postcode-district
// geography, not a guess — e.g. HU17 is specifically Beverley's own
// district, not greater Hull; YO15/16 is specifically Bridlington/Filey.
// Checked before the area-level table; only fires for listed districts.
const POSTCODE_DISTRICT_TO_CITY = {
  // HU (Hull postcode area): HU1-16 = Hull & suburbs, HU17 = Beverley itself
  HU17: ['beverley'],
  // YO (York postcode area): YO15/16 = Bridlington & Filey; YO8/30/32 etc = York side
  YO15: ['bridlington'], YO16: ['bridlington'],
  // YO25 = Driffield, East Riding — same council area as Bridlington and
  // closer to it (~11mi) than York (~28mi) or the declared-but-unmapped Beverley (~13mi)
  YO25: ['bridlington'],
  YO8: ['york'], YO19: ['york'], YO23: ['york'], YO24: ['york'],
  YO26: ['york'], YO30: ['york'], YO31: ['york'], YO32: ['york'],
  YO41: ['york'], YO42: ['york'], YO43: ['york'], YO51: ['york'],
  YO60: ['york'], YO61: ['york'], YO62: ['york'],
  // DN15-DN17 = Scunthorpe (own hub since phase 7-02), not Doncaster
  DN15: ['scunthorpe'], DN16: ['scunthorpe'], DN17: ['scunthorpe'],
  // Birmingham-area towns that have their own hub since the 12 Nov 2026 sweep (towns from
  // postcodes.io, as recorded in reports/birmingham-area-venue-sweep-2026-11-12.md). Only
  // districts that hold a retagged venue are listed; B, WS, WV, DY and TF otherwise stay
  // "birmingham" below. B78 holds both Drayton Bassett (Tamworth hub) and Middleton.
  B37: ['solihull'], B90: ['solihull'], B91: ['solihull'], B92: ['solihull'],
  B45: ['barnt-green'], B47: ['wythall'], B48: ['alvechurch'],
  B62: ['halesowen'], B63: ['halesowen'], B65: ['smethwick'],
  B70: ['west-bromwich'], B71: ['west-bromwich'],
  B77: ['tamworth'], B78: ['tamworth', 'middleton'], B79: ['tamworth'], WS14: ['tamworth'],
  CV10: ['nuneaton'], CV11: ['nuneaton'],
  DY1: ['dudley'], DY2: ['dudley'], DY6: ['dudley'], DY3: ['himley'], DY4: ['tipton'],
  DY5: ['stourbridge'], DY8: ['stourbridge'],
  DY10: ['kidderminster'], DY11: ['kidderminster'], DY14: ['cleobury-mortimer'],
  WS1: ['walsall'], WS2: ['walsall'], WS9: ['aldridge'], WS11: ['cannock'],
  WV1: ['wolverhampton'], WV10: ['wolverhampton'], WV11: ['wolverhampton'], WV14: ['wolverhampton'],
  WV5: ['wombourne'], WV12: ['willenhall'],
  TF4: ['telford'], TF7: ['telford'], TF11: ['shifnal'],
  // S (Sheffield postcode area): S70-S75 = Barnsley, not Sheffield
  S70: ['barnsley'], S71: ['barnsley'], S72: ['barnsley'],
  S73: ['barnsley'], S74: ['barnsley'], S75: ['barnsley'],
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Short/hyphenated core word for name matching, e.g. "Stoke-on-Trent" -> "Stoke".
function coreName(name) {
  return name.split(/-on-|-upon-/i)[0].trim()
}

// District-level lookup takes precedence over the coarser area-level table
// (e.g. HU17 -> beverley, not the area's hull/beverley pair).
export function expectedCitiesForPostcode(pc) {
  const district = postcodeDistrict(pc)
  if (district && POSTCODE_DISTRICT_TO_CITY[district]) {
    return { expected: POSTCODE_DISTRICT_TO_CITY[district], detail: `postcode district ${district}` }
  }
  const area = postcodeArea(pc)
  const expected = area ? POSTCODE_TO_CITIES[area] : null
  return expected ? { expected, detail: `postcode area ${area}` } : null
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
    const resolved = expectedCitiesForPostcode(v.postcode)
    if (resolved && resolved.expected.includes(v.city_slug)) {
      return null
    }
  }

  const signals = []

  // 1. Postcode
  let postcodeExpected = null
  if (v.postcode && String(v.postcode).trim()) {
    const resolved = expectedCitiesForPostcode(v.postcode)
    if (resolved && !resolved.expected.includes(v.city_slug)) {
      postcodeExpected = resolved.expected
      signals.push({ type: 'postcode', expected: resolved.expected, detail: `${resolved.detail} (${v.postcode}) -> ${resolved.expected.join('/')}` })
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
